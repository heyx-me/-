import pkgScrapers from 'israeli-bank-scrapers';
const { createScraper, SCRAPERS } = pkgScrapers;
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const { enrichTransactions } = require('./utils/categorizer.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const CHROMIUM_PATH = '/data/data/com.termux/files/usr/bin/chromium-browser';
const AUTH_PORT = 3001;

// --- State ---
const jobs = new Map(); // jobId -> { status, result, error, otpResolver, ... }
const privateKeys = new Map(); // conversationId -> privateKey PEM
let publicUrl = null;

// --- Helpers ---
async function readTokens() {
    try {
        const data = await fs.readFile(TOKENS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

async function writeTokens(tokens) {
    await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

// --- Scraper Logic ---
async function runScrape(jobId, credentials, companyId, startDate) {
    const job = jobs.get(jobId);
    if (!job) return;

    try {
        console.log(`[RafiAgent] Starting scrape for ${companyId} (Job ${jobId})`);
        const options = {
            companyId,
            startDate: new Date(startDate),
            combineInstallments: false,
            showBrowser: false,
            verbose: true, // Enable verbose logs
            executablePath: CHROMIUM_PATH,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        };

        const scraper = createScraper(options);
        const scrapeCreds = { ...credentials };

        if (['oneZero', 'isracard', 'hapoalim', 'leumi', 'discount'].includes(companyId)) {
             scrapeCreds.otpCodeRetriever = async () => {
                 console.log(`[RafiAgent] Job ${jobId} waiting for OTP...`);
                 job.status = 'WAITING_FOR_OTP';
                 // Ensure we update status via callback
                 if (job.onUpdate) await job.onUpdate('OTP_REQUIRED');
                 
                 return new Promise((resolve, reject) => {
                     const t = setTimeout(() => {
                         reject(new Error('OTP Timeout'));
                     }, 300000); // 5 min timeout
                     
                     job.otpResolver = (code) => {
                         clearTimeout(t);
                         console.log(`[RafiAgent] Job ${jobId} received OTP.`);
                         job.status = 'RUNNING';
                         // We don't strictly need to send OTP_RECEIVED back to UI, but helpful for debug
                         resolve(code);
                     };
                 });
             };
        }

        console.log(`[RafiAgent] Launching scraper...`);
        const result = await scraper.scrape(scrapeCreds);
        console.log(`[RafiAgent] Scrape result: success=${result.success}`);

        if (result.success) {
            // Enrich with categories
            if (result.accounts) {
                console.log(`[RafiAgent] Enriching transactions...`);
                for (const account of result.accounts) {
                    if (account.txns) {
                        account.txns = await enrichTransactions(account.txns);
                    }
                }
            }

            job.status = 'COMPLETED';
            job.result = result;
            if (job.onUpdate) await job.onUpdate('COMPLETED', result);
        } else {
            throw new Error(result.errorType || result.errorMessage);
        }

    } catch (e) {
        console.error(`[RafiAgent] Job ${jobId} failed:`, e);
        job.status = 'FAILED';
        job.error = e.message;
        if (job.onUpdate) await job.onUpdate('FAILED', { error: e.message });
    }
}

// --- Main Handler ---
export class RafiAgent {
    constructor(globalSendReply) {
        this.sendReply = globalSendReply;
        
        // Start Auth Server
        this.app = express();
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder']
        }));
        this.app.use(bodyParser.json());

        this.app.post('/auth/:conversationId', async (req, res) => {
            const { conversationId } = req.params;
            const { encryptedData } = req.body;

            if (!conversationId || !encryptedData) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            console.log(`[RafiAgent] Received encrypted auth for ${conversationId}`);
            
            // Decrypt
            const privateKey = privateKeys.get(conversationId);
            if (!privateKey) {
                return res.status(400).json({ error: 'Session expired or invalid' });
            }

            let companyId, credentials;
            try {
                const buffer = Buffer.from(encryptedData, 'base64');
                const decrypted = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_PKCS1_PADDING,
                    },
                    buffer
                );
                const json = JSON.parse(decrypted.toString('utf8'));
                companyId = json.companyId;
                credentials = json.credentials;
                
                // Clear key for security (one-time use)
                privateKeys.delete(conversationId);
            } catch (e) {
                console.error("[RafiAgent] Decryption failed:", e);
                return res.status(400).json({ error: 'Decryption failed' });
            }

            // Define a reply wrapper for this conversation
            const replyCallback = async (msg) => {
                if (this.sendReply) {
                    await this.sendReply('rafi', conversationId, msg);
                }
            };

            // Trigger login
            this.handleLogin({ companyId, credentials }, replyCallback);

            res.json({ success: true, message: 'Authentication process started' });
        });

        this.app.listen(AUTH_PORT, () => {
            console.log(`[RafiAgent] Auth server running on port ${AUTH_PORT}`);
            this.startTunnel();
        });
    }

    startTunnel() {
        console.log('[RafiAgent] Starting Serveo tunnel...');
        // ssh -R 80:localhost:3001 serveo.net
        // strictHostKeyChecking=no to avoid prompt
        const ssh = spawn('ssh', [
            '-o', 'StrictHostKeyChecking=no',
            '-R', `80:localhost:${AUTH_PORT}`,
            'serveo.net'
        ]);

        ssh.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[Tunnel] ${output}`);
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.serveo\.net/);
            if (match) {
                publicUrl = match[0];
                console.log(`[RafiAgent] Public Tunnel URL: ${publicUrl}`);
            }
        });

        ssh.stderr.on('data', (data) => {
            // Serveo sometimes prints info to stderr
            const output = data.toString();
            const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.serveo\.net/);
            if (match) {
                publicUrl = match[0];
                console.log(`[RafiAgent] Public Tunnel URL: ${publicUrl}`);
            }
        });

        ssh.on('close', (code) => {
            console.log(`[RafiAgent] Tunnel process exited with code ${code}`);
            publicUrl = null;
            // Retry logic could go here
        });
    }

    async handleMessage(message, replyCallback) {
        try {
            const content = typeof message.content === 'string' 
                ? JSON.parse(message.content) 
                : message.content;
            
            if (!content || !content.action) return;

            console.log(`[RafiAgent] Action: ${content.action}`);

            switch (content.action) {
                case 'INIT_SESSION':
                    await replyCallback({
                        type: 'WELCOME',
                        text: "Welcome to Rafi. Please log in to your bank."
                    });
                    break;

                case 'REQUEST_AUTH_URL':
                    if (!publicUrl) {
                        console.log("[RafiAgent] Tunnel not ready, restarting...");
                        this.startTunnel();
                        // Wait a bit?
                        await new Promise(r => setTimeout(r, 2000));
                    }
                    
                    const baseUrl = publicUrl || `http://localhost:${AUTH_PORT}`;
                    const authUrl = `${baseUrl}/auth/${message.conversation_id}`;
                    
                    // Generate Key Pair
                    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                      modulusLength: 2048,
                      publicKeyEncoding: { type: 'spki', format: 'pem' },
                      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                    });
                    
                    // Store Private Key
                    privateKeys.set(message.conversation_id, privateKey);
                    
                    console.log(`[RafiAgent] Sending Auth URL & Public Key: ${authUrl}`);
                    
                    await replyCallback({
                        type: 'AUTH_URL_READY',
                        url: authUrl,
                        publicKey: publicKey
                    });
                    break;

                case 'FETCH':
                    await this.handleFetch(content, replyCallback);
                    break;

                case 'SUBMIT_OTP':
                    await this.handleOtp(content, replyCallback);
                    break;
            }

        } catch (e) {
            console.error('[RafiAgent] Parse error or handler failed:', e);
        }
    }

    async handleLogin(payload, replyCallback) {
        const { companyId, credentials } = payload;
        if (!companyId || !credentials) {
            await replyCallback({ type: 'ERROR', error: 'Missing credentials' });
            return;
        }

        await replyCallback({ type: 'STATUS', text: 'Verifying credentials...' });

        // Run a verification scrape (last 30 days)
        const jobId = uuidv4();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        jobs.set(jobId, {
            id: jobId,
            status: 'RUNNING',
            reply: replyCallback, // Store callback
            onUpdate: async (status, data) => {
                console.log(`[RafiAgent] onUpdate: ${status}`);
                const job = jobs.get(jobId);
                const reply = job?.reply || replyCallback;

                if (status === 'OTP_REQUIRED') {
                    await reply({ type: 'OTP_REQUIRED', jobId: jobId });
                } else if (status === 'COMPLETED') {
                    console.log(`[RafiAgent] Saving token and sending success...`);
                    // Save token
                    const token = uuidv4();
                    const tokens = await readTokens();
                    tokens[token] = { companyId, credentials, createdAt: new Date().toISOString() };
                    await writeTokens(tokens);

                    console.log(`[RafiAgent] Token saved. Sending reply...`);
                    const payload = { 
                        type: 'LOGIN_SUCCESS', 
                        token, 
                        data: data 
                    };
                    const payloadSize = JSON.stringify(payload).length;
                    console.log(`[RafiAgent] Payload size: ${payloadSize} bytes`);
                    
                    await reply(payload);
                    console.log(`[RafiAgent] Reply sent.`);
                } else if (status === 'FAILED') {
                    console.log(`[RafiAgent] Sending ERROR reply: ${data.error}`);
                    await reply({ type: 'ERROR', error: data.error });
                    console.log(`[RafiAgent] ERROR reply sent.`);
                }
            }
        });

        // Fire and forget (managed by onUpdate)
        runScrape(jobId, credentials, companyId, startDate);
    }

    async handleFetch(payload, replyCallback) {
        const { token, startDate, endDate } = payload;
        const tokens = await readTokens();
        const session = tokens[token];

        if (!session) {
            await replyCallback({ type: 'ERROR', error: 'Invalid token. Please login again.' });
            return;
        }

        const jobId = uuidv4();
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        await replyCallback({ type: 'STATUS', text: 'Syncing data...' });

        jobs.set(jobId, {
            id: jobId,
            status: 'RUNNING',
            reply: replyCallback,
            onUpdate: async (status, data) => {
                const job = jobs.get(jobId);
                const reply = job?.reply || replyCallback;

                if (status === 'OTP_REQUIRED') {
                    await reply({ type: 'OTP_REQUIRED', jobId: jobId });
                } else if (status === 'COMPLETED') {
                    await reply({ type: 'DATA', data: data });
                } else if (status === 'FAILED') {
                    await reply({ type: 'ERROR', error: data.error });
                }
            }
        });

        runScrape(jobId, session.credentials, session.companyId, start);
    }

    async handleOtp(payload, replyCallback) {
        const { jobId, otp } = payload;
        const job = jobs.get(jobId);
        
        if (!job || !job.otpResolver) {
            await replyCallback({ type: 'ERROR', error: 'No OTP request found' });
            return;
        }

        // Update the reply callback for the job to the current session (if changed)
        job.reply = replyCallback;

        await replyCallback({ type: 'STATUS', text: 'Verifying OTP...' });
        job.otpResolver(otp);
    }
}

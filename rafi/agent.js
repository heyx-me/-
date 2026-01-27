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
    constructor(globalReplyMethods) {
        // Support both legacy function and new object interface
        if (typeof globalReplyMethods === 'function') {
            this.replyMethods = { send: globalReplyMethods };
        } else {
            this.replyMethods = globalReplyMethods;
        }
        
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

            // Define a reply control for this conversation
            const replyControl = {
                send: async (msg) => {
                    if (this.replyMethods.send) {
                        return await this.replyMethods.send('rafi', conversationId, msg);
                    }
                },
                update: async (id, msg) => {
                    if (this.replyMethods.update) {
                        await this.replyMethods.update(id, msg);
                    }
                },
                delete: async (id) => {
                    if (this.replyMethods.delete) {
                        await this.replyMethods.delete(id);
                    }
                }
            };

            // Trigger login
            this.handleLogin({ companyId, credentials }, replyControl);

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
            console.log(`[Tunnel] ${output.trim()}`);
            
            // Match standard Serveo output: "Forwarding HTTP traffic from https://..."
            const match = output.match(/Forwarding HTTP traffic from (https:\/\/[^\s]+)/);
            if (match) {
                publicUrl = match[1];
                console.log(`[RafiAgent] Public Tunnel URL: ${publicUrl}`);
            }
        });

        ssh.stderr.on('data', (data) => {
            const output = data.toString();
            // Serveo often prints the forwarding info to stderr
            console.log(`[Tunnel stderr] ${output.trim()}`);
            
            const match = output.match(/Forwarding HTTP traffic from (https:\/\/[^\s]+)/);
            if (match) {
                publicUrl = match[1];
                console.log(`[RafiAgent] Public Tunnel URL: ${publicUrl}`);
            }
        });

        ssh.on('close', (code) => {
            console.log(`[RafiAgent] Tunnel process exited with code ${code}`);
            publicUrl = null;
            // Retry logic could go here
        });
    }

    async waitForTunnel(timeoutMs = 15000) {
        if (publicUrl) return publicUrl;
        
        console.log(`[RafiAgent] Waiting for tunnel URL...`);
        const start = Date.now();
        
        // If tunnel process isn't running (or we don't track it well), restart?
        // For now, assume startTunnel() was called in constructor.
        if (!publicUrl) {
             // Maybe trigger start if not running? 
             // But let's just poll.
        }

        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (publicUrl) {
                    clearInterval(interval);
                    resolve(publicUrl);
                }
                if (Date.now() - start > timeoutMs) {
                    clearInterval(interval);
                    reject(new Error("Tunnel creation timed out"));
                }
            }, 500);
        });
    }

    async handleMessage(message, replyControl) {
        try {
            const content = typeof message.content === 'string' 
                ? JSON.parse(message.content) 
                : message.content;
            
            if (!content || !content.action) return;

            console.log(`[RafiAgent] Action: ${content.action}`);
            
            // Ensure replyControl has expected methods (backward compatibility wrapper)
            const safeReplyControl = typeof replyControl === 'function' 
                ? { send: replyControl, update: async () => {}, delete: async () => {} }
                : replyControl;

            switch (content.action) {
                case 'INIT_SESSION':
                    await safeReplyControl.send({
                        type: 'WELCOME',
                        text: "Welcome to Rafi. Please log in to your bank."
                    });
                    break;

                case 'REQUEST_AUTH_URL':
                    try {
                        const url = await this.waitForTunnel();
                        const authUrl = `${url}/auth/${message.conversation_id}`;
                        
                        // Generate Key Pair
                        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                          modulusLength: 2048,
                          publicKeyEncoding: { type: 'spki', format: 'pem' },
                          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                        });
                        
                        // Store Private Key
                        privateKeys.set(message.conversation_id, privateKey);
                        
                        console.log(`[RafiAgent] Sending Auth URL & Public Key: ${authUrl}`);
                        
                        await safeReplyControl.send({
                            type: 'AUTH_URL_READY',
                            url: authUrl,
                            publicKey: publicKey
                        });
                    } catch (e) {
                         console.error("[RafiAgent] Tunnel Error:", e);
                         await safeReplyControl.send({
                            type: 'ERROR',
                            error: "Failed to establish secure tunnel. Please try again."
                         });
                    }
                    break;

                case 'FETCH':
                    await this.handleFetch(content, safeReplyControl);
                    break;

                case 'SUBMIT_OTP':
                    await this.handleOtp(content, safeReplyControl);
                    break;
            }

        } catch (e) {
            console.error('[RafiAgent] Parse error or handler failed:', e);
        }
    }

    async handleLogin(payload, replyControl) {
        const { companyId, credentials } = payload;
        if (!companyId || !credentials) {
            await replyControl.send({ type: 'ERROR', error: 'Missing credentials' });
            return;
        }

        // Initial Status
        const statusMsgId = await replyControl.send({ type: 'STATUS', text: 'Verifying credentials...' });

        // Run a verification scrape (last 30 days)
        const jobId = uuidv4();
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        jobs.set(jobId, {
            id: jobId,
            status: 'RUNNING',
            reply: replyControl, // Store callback object
            statusMessageId: statusMsgId, // Track the message ID to update
            onUpdate: async (status, data) => {
                console.log(`[RafiAgent] onUpdate: ${status}`);
                const job = jobs.get(jobId);
                const reply = job?.reply || replyControl;
                const msgId = job?.statusMessageId;

                if (status === 'OTP_REQUIRED') {
                    const payload = { type: 'OTP_REQUIRED', jobId: jobId };
                    if (msgId) await reply.update(msgId, payload);
                    else job.statusMessageId = await reply.send(payload);
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
                    
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);
                    
                    console.log(`[RafiAgent] Reply sent/updated.`);
                } else if (status === 'FAILED') {
                    console.log(`[RafiAgent] Sending ERROR reply: ${data.error}`);
                    const payload = { type: 'ERROR', error: data.error };
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);
                    console.log(`[RafiAgent] ERROR reply sent.`);
                }
            }
        });

        // Fire and forget (managed by onUpdate)
        runScrape(jobId, credentials, companyId, startDate);
    }

    async handleFetch(payload, replyControl) {
        const { token, startDate, endDate } = payload;
        const tokens = await readTokens();
        const session = tokens[token];

        if (!session) {
            await replyControl.send({ type: 'ERROR', error: 'Invalid token. Please login again.' });
            return;
        }

        const jobId = uuidv4();
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const statusMsgId = await replyControl.send({ type: 'STATUS', text: 'Syncing data...' });

        jobs.set(jobId, {
            id: jobId,
            status: 'RUNNING',
            reply: replyControl,
            statusMessageId: statusMsgId,
            onUpdate: async (status, data) => {
                const job = jobs.get(jobId);
                const reply = job?.reply || replyControl;
                const msgId = job?.statusMessageId;

                if (status === 'OTP_REQUIRED') {
                    const payload = { type: 'OTP_REQUIRED', jobId: jobId };
                    if (msgId) await reply.update(msgId, payload);
                    else job.statusMessageId = await reply.send(payload);
                } else if (status === 'COMPLETED') {
                    const payload = { type: 'DATA', data: data };
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);
                } else if (status === 'FAILED') {
                    const payload = { type: 'ERROR', error: data.error };
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);
                }
            }
        });

        runScrape(jobId, session.credentials, session.companyId, start);
    }

    async handleOtp(payload, replyControl) {
        const { jobId, otp } = payload;
        const job = jobs.get(jobId);
        
        if (!job || !job.otpResolver) {
            await replyControl.send({ type: 'ERROR', error: 'No OTP request found' });
            return;
        }

        // Update the reply callback for the job to the current session (if changed)
        job.reply = replyControl;

        // When OTP is submitted, we are in a new conversation context (usually).
        // Sending a new status message is appropriate here as a response to the user's input.
        // We track THIS new message as the one to update for future status changes.
        job.statusMessageId = await replyControl.send({ type: 'STATUS', text: 'Verifying OTP...' });

        job.otpResolver(otp);
    }
}

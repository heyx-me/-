import pkgScrapers from 'israeli-bank-scrapers';
const { createScraper, SCRAPERS } = pkgScrapers;
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const HapoalimScraper = require('israeli-bank-scrapers/lib/scrapers/hapoalim').default;
const { fetchGetWithinPage } = require('israeli-bank-scrapers/lib/helpers/fetch');

const LoginResults = {
    Success: 'SUCCESS',
    InvalidPassword: 'INVALID_PASSWORD',
    ChangePassword: 'CHANGE_PASSWORD',
    Timeout: 'TIMEOUT',
    UnknownError: 'UNKNOWN_ERROR',
};

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { enrichTransactions } from './utils/categorizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const USER_DATA_DIR = path.join(__dirname, 'user_data');
const CHROMIUM_PATH = '/data/data/com.termux/files/usr/bin/chromium-browser';
const AUTH_PORT = 3001;

// --- State ---
const jobs = new Map(); // jobId -> { status, result, error, otpResolver, ... }
const privateKeys = new Map(); // conversationId -> privateKey PEM
let publicUrl = null;

// --- Helpers ---
async function saveUserData(conversationId, data) {
    if (!conversationId) return;
    try {
        try {
            await fs.access(USER_DATA_DIR);
        } catch {
            await fs.mkdir(USER_DATA_DIR, { recursive: true });
        }
        const filePath = path.join(USER_DATA_DIR, `${conversationId}.json`);
        
        let existingData = {};
        try {
            const content = await fs.readFile(filePath, 'utf8');
            if (content && content.trim()) {
                existingData = JSON.parse(content);
            }
        } catch (e) {
            console.log(`[RafiAgent] No valid existing data for ${conversationId}, starting fresh.`);
        }

        // Merge logic: prioritize new data but keep unique accounts from old data
        const mergedAccounts = [...(data.accounts || [])];
        const existingAccounts = existingData.accounts || [];

        existingAccounts.forEach(oldAcc => {
            const exists = mergedAccounts.some(newAcc => newAcc.accountNumber === oldAcc.accountNumber);
            if (!exists) {
                mergedAccounts.push(oldAcc);
            }
        });

        const mergedData = {
            ...existingData,
            ...data,
            accounts: mergedAccounts,
            updatedAt: new Date().toISOString()
        };

        await fs.writeFile(filePath, JSON.stringify(mergedData, null, 2));
        console.log(`[RafiAgent] Merged and saved user data for ${conversationId}`);
    } catch (e) {
        console.error(`[RafiAgent] Failed to save user data:`, e);
    }
}

async function readUserData(conversationId) {
    try {
        const filePath = path.join(USER_DATA_DIR, `${conversationId}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

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

// Custom Hapoalim Scraper to support MFA/OTP
class HapoalimScraperWithMFA extends HapoalimScraper {
    async fetchData() {
        console.log(`[HapoalimMFA] fetchData called. Ensuring accounts API is ready...`);
        const accountDataUrl = `${this.baseUrl}/ServerServices/general/accounts`;
        
        let retries = 15;
        let accountsInfo;
        
        while (retries > 0) {
            try {
                // Check for and dismiss any potential blocking popups/cookies
                await this.page.evaluate(() => {
                    const labels = ['דלג', 'סגור', 'הבנתי', 'אישור', 'X'];
                    const buttons = Array.from(document.querySelectorAll('button, a, .btn, [role="button"]'));
                    const target = buttons.find(b => labels.some(l => b.innerText.trim() === l));
                    if (target && target.offsetParent !== null) target.click();
                });

                accountsInfo = await fetchGetWithinPage(this.page, accountDataUrl);
                if (Array.isArray(accountsInfo)) {
                    console.log(`[HapoalimMFA] SUCCESS! Accounts API returned an array.`);
                    break;
                }
                
                console.log(`[HapoalimMFA] Accounts API returned non-array:`, JSON.stringify(accountsInfo));
            } catch (e) {
                console.log(`[HapoalimMFA] Error fetching accounts info: ${e.message}`);
            }
            
            await new Promise(r => setTimeout(r, 4000));
            retries--;
        }
        
        return super.fetchData();
    }

    getLoginOptions(credentials) {
        const loginOptions = super.getLoginOptions(credentials);
        
        // Ensure the login URL is correct
        loginOptions.loginUrl = `${this.baseUrl}/cgi-bin/poalwwwc?reqName=getLogonPage`;
        
        // Use a modern User Agent to avoid detection
        loginOptions.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

        // Wrap postAction to handle potential OTP
        const originalPostAction = loginOptions.postAction;
        loginOptions.postAction = async () => {
            console.log(`[HapoalimMFA] Executing postAction, waiting for redirect or MFA...`);
            
            // Wait for either the MFA input or the home page to appear
            try {
                await this.page.waitForFunction(() => {
                    const text = document.body.innerText;
                    const isMFA = text.includes('קוד') || 
                                 text.includes('SMS') ||
                                 !!document.querySelector('input.ng-star-inserted');
                    const isHome = window.location.href.includes('HomePage') || 
                                  window.location.href.includes('homepage') ||
                                  text.includes('שלום') ||
                                  text.includes('יציאה');
                    return isMFA || isHome;
                }, { timeout: 30000 });
            } catch (e) {
                console.log(`[HapoalimMFA] Timeout waiting for MFA/Home state. Current URL: ${this.page.url()}`);
            }

            // Give it a small buffer for animations
            await new Promise(r => setTimeout(r, 3000));
            
            // Dismiss cookie banner / initial popups
            await this.page.evaluate(() => {
                const bannerButtons = Array.from(document.querySelectorAll('button, a, span')).filter(el => {
                    const text = el.innerText.trim();
                    return text === 'X' || text === 'סגור' || text === 'הבנתי';
                });
                bannerButtons.forEach(btn => {
                    if (btn.offsetParent !== null) btn.click();
                });
            });

            // Check state
            const pageInfo = await this.page.evaluate(() => {
                return {
                    text: document.body.innerText,
                    hasStarInput: !!document.querySelector('input.ng-star-inserted'),
                    url: window.location.href
                };
            });

            const isMFAPage = pageInfo.text.includes('קוד') || 
                             pageInfo.text.includes('SMS') ||
                             pageInfo.hasStarInput;

            console.log(`[HapoalimMFA] State Check - URL: ${pageInfo.url}, MFA Detected: ${isMFAPage}`);

            if (isMFAPage && credentials.otpCodeRetriever) {
                console.log(`[HapoalimMFA] MFA detected, triggering otpCodeRetriever`);
                
                // Take a screenshot of the MFA page for debugging
                try {
                    const debugPath = path.join(USER_DATA_DIR, `mfa_detected_${Date.now()}.png`);
                    await this.page.screenshot({ path: debugPath });
                } catch (e) {}

                const otpCode = await credentials.otpCodeRetriever();
                if (otpCode) {
                    console.log(`[HapoalimMFA] OTP received (length: ${otpCode.length}), filling fields...`);
                    
                    const inputs = await this.page.$$('input.ng-star-inserted, input[type="tel"], .digit-input input');
                    console.log(`[HapoalimMFA] Found ${inputs.length} potential digit inputs.`);
                    
                    if (inputs.length >= otpCode.length) {
                        for (let i = 0; i < otpCode.length; i++) {
                            await inputs[i].click({ clickCount: 3 }); // Select all
                            await inputs[i].press('Backspace');
                            await inputs[i].type(otpCode[i], { delay: 150 });
                        }
                        
                        console.log(`[HapoalimMFA] Digits typed. Clicking continue...`);
                        const clicked = await this.page.evaluate(() => {
                            const labels = ['המשך', 'כניסה', 'אישור', 'שלח'];
                            const buttons = Array.from(document.querySelectorAll('button, .btn, input[type="submit"]')).filter(b => {
                                const text = b.innerText.trim();
                                return b.offsetParent !== null && labels.some(l => text.includes(l));
                            });

                            if (buttons.length > 0) {
                                buttons[buttons.length - 1].click(); // Prefer last (form) over banners
                                return true;
                            }
                            return false;
                        });

                        console.log(`[HapoalimMFA] Clicked continue button: ${clicked}`);
                        
                        // Wait for redirect
                        await new Promise(r => setTimeout(r, 5000));

                        try {
                            await this.page.waitForFunction(() => {
                                const url = window.location.href;
                                const text = document.body.innerText;
                                const isHome = url.includes('homepage') || url.includes('HomePage') || url.includes('ng-portals-bt');
                                const hasLogout = text.includes('יציאה') || text.includes('להתנתק');
                                return isHome && hasLogout;
                            }, { timeout: 60000 });
                            console.log(`[HapoalimMFA] Logged-in state detected.`);
                        } catch (navError) {
                            console.log(`[HapoalimMFA] Navigation info/warning: ${navError.message}. URL: ${this.page.url()}`);
                        }
                    } else {
                        console.error(`[HapoalimMFA] Could not find enough OTP input fields (found ${inputs.length})`);
                    }
                }
            } else if (originalPostAction) {
                // If we are already on the home page, don't wait for another redirect as it will timeout
                const url = this.page.url();
                if (url.includes('homepage') || url.includes('HomePage') || url.includes('ng-portals')) {
                    console.log(`[HapoalimMFA] Already on homepage or dashboard, skipping original postAction to avoid timeout.`);
                    return;
                }
                
                console.log(`[HapoalimMFA] No MFA needed or already logged in, running original postAction`);
                await originalPostAction();
            }
        };

        const baseResults = loginOptions.possibleResults;
        if (baseResults && baseResults[LoginResults.Success]) {
            baseResults[LoginResults.Success].push(/.*\/homepage.*/i);
            baseResults[LoginResults.Success].push(/.*\/HomePage.*/i);
            baseResults[LoginResults.Success].push(/.*\/ng-portals-bt\/rb\/he\/homepage/i);
            baseResults[LoginResults.Success].push(/.*\/ng-portals\/rb\/he\/homepage/i);
            baseResults[LoginResults.Success].push(({ page }) => page.evaluate(() => (document.body.innerText.includes('יציאה') || document.body.innerText.includes('להתנתק')) && !document.body.innerText.includes('קוד אימות')));
        }
        
        return loginOptions;
    }
}

async function runScrape(jobId, credentials, companyId, startDate, conversationId = null) {
    const job = jobs.get(jobId);
    if (!job) return;

    try {
        console.log(`[RafiAgent] Starting scrape for ${companyId} (Job ${jobId})`);
        
        const sessionDir = conversationId ? path.join(USER_DATA_DIR, 'sessions', conversationId, companyId) : null;
        if (sessionDir) {
            await fs.mkdir(sessionDir, { recursive: true });
        }

        const options = {
            companyId,
            startDate: new Date(startDate),
            combineInstallments: false,
            showBrowser: false,
            verbose: true,
            executablePath: CHROMIUM_PATH,
            userDataDir: sessionDir,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        };

        // Use custom scraper for Hapoalim
        let scraper;
        if (companyId === 'hapoalim') {
            console.log(`[RafiAgent] Using custom HapoalimScraperWithMFA`);
            scraper = new HapoalimScraperWithMFA(options);
        } else {
            scraper = createScraper(options);
        }

        const scrapeCreds = { ...credentials };

        if (['oneZero', 'isracard', 'hapoalim', 'leumi', 'discount'].includes(companyId)) {
             scrapeCreds.otpCodeRetriever = async () => {
                 console.log(`[RafiAgent] Job ${jobId} (MFA) - Triggering UI for OTP...`);
                 job.status = 'WAITING_FOR_OTP';
                 // Ensure we update status via callback
                 if (job.onUpdate) await job.onUpdate('OTP_REQUIRED');
                 
                 return new Promise((resolve, reject) => {
                     const t = setTimeout(() => {
                         console.error(`[RafiAgent] Job ${jobId} OTP Timeout after 5 mins`);
                         reject(new Error('OTP Timeout'));
                     }, 300000); // 5 min timeout
                     
                     job.otpResolver = (code) => {
                         clearTimeout(t);
                         console.log(`[RafiAgent] Job ${jobId} received OTP code from UI.`);
                         job.status = 'RUNNING';
                         resolve(code);
                     };
                 });
             };
        }

        console.log(`[RafiAgent] Launching scraper.scrape()...`);
        const result = await scraper.scrape(scrapeCreds);
        console.log(`[RafiAgent] scraper.scrape() finished. Success: ${result.success}`);

        if (!result.success) {
            console.error(`[RafiAgent] Scrape failed. Type: ${result.errorType}, Message: ${result.errorMessage}`);
            // If the scraper provides more details in the result object, log them
            if (result.error) console.error(`[RafiAgent] Scraper error detail: ${JSON.stringify(result.error)}`);
        }

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

            if (conversationId) {
                await saveUserData(conversationId, result);
            }

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
        this.activeTunnelSessions = new Set();
        this.app.use(cors({
            origin: '*',
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder']
        }));
        this.app.use(bodyParser.json());

        this.app.post('/auth/:conversationId/:senderId', async (req, res) => {
            const { conversationId, senderId } = req.params;
            const { encryptedData } = req.body;
            const sessionKey = `${conversationId}:${senderId}`;

            if (!conversationId || !encryptedData) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            console.log(`[RafiAgent] Received encrypted auth for ${sessionKey}`);

            if (typeof encryptedData !== 'string') {
                return res.status(400).json({ error: 'encryptedData must be a base64 string' });
            }

            // Decrypt
            const keyEntry = privateKeys.get(sessionKey);
            const privateKey = keyEntry?.key;
            if (!privateKey) {
                console.error(`[RafiAgent] No private key found for ${conversationId}`);
                return res.status(400).json({ error: 'Session expired or invalid' });
            }

            let companyId, credentials, action, jobId, otp;
            try {
                console.log(`[RafiAgent] Attempting decryption with key generated at ${new Date(keyEntry.timestamp).toISOString()}`);
                const buffer = Buffer.from(encryptedData, 'base64');
                console.log(`[RafiAgent] Encrypted buffer length: ${buffer.length}`);

                const decrypted = crypto.privateDecrypt(
                    {
                        key: privateKey,
                        padding: crypto.constants.RSA_PKCS1_PADDING,
                    },
                    buffer
                );
                const decryptedStr = decrypted.toString('utf8');
                console.log(`[RafiAgent] Decrypted raw length: ${decryptedStr.length}`);

                try {
                    const json = JSON.parse(decryptedStr);
                    companyId = json.companyId;
                    credentials = json.credentials;
                    action = json.action;
                    jobId = json.jobId;
                    otp = json.otp;
                } catch (parseError) {
                    console.error(`[RafiAgent] JSON Parse Error. Decrypted start (hex): ${decrypted.slice(0, 10).toString('hex')}...`);
                    console.error(`[RafiAgent] JSON Parse Error. Decrypted start (utf8): ${decryptedStr.substring(0, 20)}...`);
                    throw parseError;
                }

                // Clear key for security (one-time use) ONLY after successful parse
                privateKeys.delete(sessionKey);
            } catch (e) {
                console.error("[RafiAgent] Decryption failed:", e.message);
                return res.status(400).json({ error: 'Decryption failed' });
            }
            // Define a reply control for this conversation
            const replyControl = {
                send: async (msg, isBot = true, senderId = 'system') => {
                    if (this.replyMethods.send) {
                        return await this.replyMethods.send('rafi', conversationId, typeof msg === 'string' ? msg : JSON.stringify(msg), isBot, senderId);
                    }
                },
                update: async (id, msg) => {
                    if (this.replyMethods.update) {
                        // root agent.js: updateReply(messageId, content)
                        return await this.replyMethods.update(id, typeof msg === 'string' ? msg : JSON.stringify(msg));
                    }
                },
                delete: async (id) => {
                    if (this.replyMethods.delete) {
                        return await this.replyMethods.delete(id);
                    }
                }
            };

            if (action === 'SUBMIT_OTP') {
                this.handleOtp({ jobId, otp }, replyControl);
            } else {
                // Trigger login
                this.handleLogin({ companyId, credentials }, replyControl, conversationId, senderId);
            }

            res.json({ success: true, message: 'Authentication process started' });
        });

        this.app.get('/ping', (req, res) => {
            res.json({ status: 'ok' });
        });

        this.app.listen(AUTH_PORT, () => {
            // Tunnel is now lazy-loaded; don't start automatically
        });
    }

    /**
     * Lazy-start the tunnel and return a promise that resolves to the public URL.
     * Ensures only one tunnel process is active at a time.
     */
    async startTunnel() {
        if (this._tunnelPromise) return this._tunnelPromise;

        this._tunnelPromise = new Promise((resolve, reject) => {
            this._tunnelReject = reject; // Store for stopTunnel
            console.log('[RafiAgent] Initiating secure tunnel...');
            this.connectTunnel((url) => {
                if (url) {
                    resolve(url);
                    this._tunnelReject = null;
                } else {
                    this._tunnelPromise = null;
                    this._tunnelReject = null;
                    reject(new Error("Failed to retrieve tunnel URL"));
                }
            });

            // Timeout if it takes too long to get a URL
            setTimeout(() => {
                if (this._tunnelPromise && !publicUrl) {
                    this._tunnelPromise = null;
                    if (this._tunnelReject) {
                        this._tunnelReject(new Error("Tunnel initiation timed out"));
                        this._tunnelReject = null;
                    }
                }
            }, 30000);
        });

        return this._tunnelPromise;
    }

    stopTunnel(conversationId = null) {
        if (conversationId) {
            this.activeTunnelSessions.delete(conversationId);
            // If we still have active users waiting for tunnel response, don't kill yet
            if (this.activeTunnelSessions.size > 0) {
                console.log(`[RafiAgent] Still have ${this.activeTunnelSessions.size} active sessions. Keeping tunnel open.`);
                return;
            }
        }

        if (this.sshProcess) {
            console.log('[RafiAgent] Shutting down secure tunnel...');
            this.sshProcess.kill();
            this.sshProcess = null;
            publicUrl = null;
            this._tunnelPromise = null;
            if (this._tunnelReject) {
                this._tunnelReject(new Error("Tunnel closed manually"));
                this._tunnelReject = null;
            }
        }
    }

    connectTunnel(onReady) {
        // Kill existing if any (cleanup)
        if (this.sshProcess) {
            try { this.sshProcess.kill(); } catch(e) {}
        }

        const ssh = spawn('ssh', [
            '-o', 'StrictHostKeyChecking=no',
            '-R', `80:localhost:${AUTH_PORT}`,
            'serveo.net'
        ]);
        
        this.sshProcess = ssh;

        const handleOutput = (data) => {
            const output = data.toString();
            const match = output.match(/Forwarding HTTP traffic from (https:\/\/[^\s]+)/);
            if (match) {
                publicUrl = match[1];
                if (onReady) {
                    onReady(publicUrl);
                    onReady = null; // Only call once
                }
            }
        };

        ssh.stdout.on('data', handleOutput);
        ssh.stderr.on('data', handleOutput);

        ssh.on('close', (code) => {
            if (this.sshProcess) {
                console.log(`[RafiAgent] Tunnel process exited (code ${code}). Retrying in 5s...`);
                publicUrl = null;
                setTimeout(() => this.connectTunnel(), 5000);
            } else {
                // If this.sshProcess is null, it was intentionally stopped
                publicUrl = null;
            }
        });
        
        ssh.on('error', (err) => {
            console.error(`[RafiAgent] Tunnel spawn error:`, err);
            if (onReady) {
                onReady(null);
                onReady = null;
            }
        });
    }

    async waitForTunnel(conversationId, senderId, timeoutMs = 30000) {
        if (conversationId && senderId) this.activeTunnelSessions.add(`${conversationId}:${senderId}`);
        if (publicUrl) return publicUrl;
        return this.startTunnel();
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
                ? { 
                    send: async (msg) => await replyControl(typeof msg === 'string' ? msg : JSON.stringify(msg), true), 
                    update: async (id, msg) => { /* update not possible with raw function */ },
                    delete: async (id) => { /* delete not possible with raw function */ }
                  }
                : {
                    send: async (msg, isBot = true, senderId) => await replyControl.send(typeof msg === 'string' ? msg : JSON.stringify(msg), isBot, senderId),
                    update: async (id, msg) => {
                        if (replyControl.update) await replyControl.update(id, typeof msg === 'string' ? msg : JSON.stringify(msg));
                    },
                    delete: async (id) => {
                        if (replyControl.delete) await replyControl.delete(id);
                    }
                };
            switch (content.action) {
                case 'INIT_SESSION':
                    await safeReplyControl.send({
                        type: 'WELCOME',
                        text: "Welcome to Rafi. Please log in to your bank."
                    });
                    break;

                case 'REQUEST_AUTH_URL':
                    try {
                        const senderId = message.sender_id || message.conversation_id;
                        const url = await this.waitForTunnel(message.conversation_id, senderId);
                        const authUrl = `${url}/auth/${message.conversation_id}/${senderId}`;
                        const sessionKey = `${message.conversation_id}:${senderId}`;
                        
                        // Generate Key Pair
                        const existingKey = privateKeys.get(sessionKey);
                        if (existingKey && (Date.now() - existingKey.timestamp < 5000)) {
                            console.log(`[RafiAgent] Using existing key for ${sessionKey} (generated ${Date.now() - existingKey.timestamp}ms ago)`);

                            await safeReplyControl.send({
                                type: 'AUTH_URL_READY',
                                url: authUrl,
                                publicKey: existingKey.publicKey
                            });
                            break;
                        }

                        const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                          modulusLength: 2048,
                          publicKeyEncoding: { type: 'spki', format: 'pem' },
                          privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
                        });

                        // Store Private Key with metadata
                        privateKeys.set(sessionKey, {
                            key: privateKey,
                            publicKey: publicKey,
                            timestamp: Date.now()
                        });

                        console.log(`[RafiAgent] Sending Auth URL & Public Key for ${sessionKey}`);

                        await safeReplyControl.send({
                            type: 'AUTH_URL_READY',
                            url: authUrl,
                            publicKey: publicKey
                        });                    } catch (e) {
                         console.error("[RafiAgent] Tunnel Error:", e);
                         await safeReplyControl.send({
                            type: 'ERROR',
                            error: "Failed to establish secure tunnel. Please try again."
                         });
                    }
                    break;

                case 'FETCH':
                    await this.handleFetch(content, safeReplyControl, message.conversation_id);
                    break;

                case 'GET_STATE':
                    console.log(`[RafiAgent] GET_STATE requested for ${message.conversation_id}`);
                    const storedData = await readUserData(message.conversation_id);
                    if (storedData) {
                        console.log(`[RafiAgent] Sending stored data for ${message.conversation_id}`);
                        await safeReplyControl.send({ type: 'DATA', data: storedData });
                    } else {
                        console.log(`[RafiAgent] No stored data found for ${message.conversation_id}`);
                    }
                    break;

                case 'SUBMIT_OTP':
                    await this.handleOtp(content, safeReplyControl);
                    break;
                
                case 'DELETE_CONVERSATION':
                    // Clean up any pending auth sessions or keys
                    if (message.conversation_id) {
                        const conversationId = message.conversation_id;
                        if (privateKeys.has(conversationId)) {
                            privateKeys.delete(conversationId);
                            console.log(`[RafiAgent] Cleared private key for deleted conversation ${conversationId}`);
                        }
                        
                        // Also delete stored user data
                        try {
                            const filePath = path.join(USER_DATA_DIR, `${conversationId}.json`);
                            await fs.unlink(filePath).catch(() => {}); // ignore if doesn't exist
                            console.log(`[RafiAgent] Deleted user data file for ${conversationId}`);
                        } catch (e) {
                             console.error(`[RafiAgent] Failed to delete user data:`, e);
                        }
                    }
                    break;
            }
            return true;

        } catch (e) {
            console.error('[RafiAgent] Parse error or handler failed:', e);
            return false;
        }
    }

    async handleLogin(payload, replyControl, conversationId = null, senderId = null) {
        const { companyId, credentials } = payload;
        const sessionKey = senderId ? `${conversationId}:${senderId}` : conversationId;
        if (!companyId || !credentials) {
            await replyControl.send({ type: 'ERROR', error: 'Missing credentials' });
            return;
        }

        // Initial Status
        const statusMsgId = await replyControl.send({ type: 'STATUS', text: 'Verifying credentials...' });

        // Run a verification scrape (last 90 days for better coverage)
        const jobId = uuidv4();
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        
        console.log(`[RafiAgent] Starting login job ${jobId} for ${companyId}`);
        
        jobs.set(jobId, {
            id: jobId,
            status: 'RUNNING',
            reply: replyControl, // Store callback object
            statusMessageId: statusMsgId, // Track the message ID to update
            onUpdate: async (status, data) => {
                console.log(`[RafiAgent] Job ${jobId} Update: ${status}`);
                const job = jobs.get(jobId);
                const reply = job?.reply || replyControl;
                const msgId = job?.statusMessageId;

                if (status === 'OTP_REQUIRED') {
                    // Signal the UI to prepare for OTP secret
                    await reply.send({ type: 'UI_COMMAND', command: 'PREPARE_SECURE_CHANNEL', params: { type: 'otp' } });
                    
                    const payload = { type: 'OTP_REQUIRED', jobId: jobId };
                    if (msgId) await reply.update(msgId, JSON.stringify(payload));
                    else job.statusMessageId = await reply.send(payload);
                } else if (status === 'COMPLETED') {
                    console.log(`[RafiAgent] Saving token and sending success...`);
                    
                    // Cleanup tunnel since it's no longer needed for auth/callback
                    this.stopTunnel(sessionKey);

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
                    
                    // Trigger the Agent to provide a conversational response
                    await this.replyMethods.send('rafi', conversationId, JSON.stringify({
                        type: 'SYSTEM',
                        event: 'SYNC_COMPLETE',
                        provider: companyId,
                        details: 'Login and initial sync successful'
                    }), true, 'system'); 
                    
                    console.log(`[RafiAgent] Reply sent/updated and SYSTEM notification dispatched.`);
                } else if (status === 'FAILED') {
                    console.log(`[RafiAgent] Sending ERROR reply: ${data.error}`);
                    
                    // Cleanup tunnel since the current flow failed
                    this.stopTunnel(sessionKey);

                    const payload = { type: 'ERROR', error: data.error };
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);

                    // Trigger Agent response
                    await this.replyMethods.send('rafi', conversationId, JSON.stringify({
                        type: 'SYSTEM',
                        event: 'SYNC_FAILED',
                        error: data.error
                    }), true, 'system'); 

                    console.log(`[RafiAgent] ERROR reply sent.`);
                }
            }
        });

        // Fire and forget (managed by onUpdate)
        runScrape(jobId, credentials, companyId, startDate, conversationId);
    }

    async handleFetch(payload, replyControl, conversationId = null) {
        const { token, startDate, endDate, sender_id } = payload;
        const sessionKey = sender_id ? `${conversationId}:${sender_id}` : conversationId;
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
                    if (msgId) await reply.update(msgId, JSON.stringify(payload));
                    else job.statusMessageId = await reply.send(payload);
                } else if (status === 'COMPLETED') {
                    // Cleanup tunnel if it was active
                    this.stopTunnel(sessionKey);

                    const payload = { type: 'DATA', data: data };
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);

                    // Trigger Agent response
                    await this.replyMethods.send('rafi', conversationId, JSON.stringify({
                        type: 'SYSTEM',
                        event: 'SYNC_COMPLETE',
                        details: 'Data fetch successful'
                    }), true, 'system'); 
                } else if (status === 'FAILED') {
                    // Cleanup tunnel if it was active
                    this.stopTunnel(sessionKey);

                    const payload = { type: 'ERROR', error: data.error };
                    if (msgId) await reply.update(msgId, payload);
                    else await reply.send(payload);

                    // Trigger Agent response
                    await this.replyMethods.send('rafi', conversationId, JSON.stringify({
                        type: 'SYSTEM',
                        event: 'SYNC_FAILED',
                        error: data.error
                    }), true, 'system'); 
                }
            }
        });

        runScrape(jobId, session.credentials, session.companyId, start, conversationId);
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

    async getContextSnapshot(conversationId) {
        const data = await readUserData(conversationId);
        if (!data) return { status: 'No data available. User needs to login or sync.' };

        const snapshot = {
            last_sync: data.scrapeId || 'Unknown',
            accounts: (data.accounts || []).map(acc => ({
                name: acc.accountName || 'Unknown',
                number: acc.accountNumber,
                balance: acc.balance,
                currency: acc.currency
            }))
        };

        return snapshot;
    }

    async getAccountData(conversationId) {
        const data = await readUserData(conversationId);
        if (data && data.accounts) {
            data.accounts.forEach(acc => {
                if (acc.txns && Array.isArray(acc.txns)) {
                    acc.txns.sort((a, b) => new Date(b.date) - new Date(a.date));
                }
            });
        }
        return data;
    }
}

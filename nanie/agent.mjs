import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { GoogleGenerativeAI } from '@google/generative-ai';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PORT = 3002;
const CACHE_FILE = path.join(__dirname, 'ella_cache.json');
const STORE_FILE = path.join(__dirname, 'baileys_store.json');
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

// --- Helper Functions ---
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        if (!data.groupId) data.groupId = '120363425029379306@g.us';
        if (!data.events) data.events = [];
        if (!data.lastMessageTimestamp) data.lastMessageTimestamp = 0;
        if (!data.processedMsgIds) data.processedMsgIds = [];
        return data;
    }
    return { groupId: '120363425029379306@g.us', apiKey: null, events: [], lastMessageTimestamp: 0, processedMsgIds: [] };
}

function saveCache(data) {
    const current = loadCache();
    const toSave = { ...current, ...data };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(toSave, null, 2));
}

function getMessageText(m) {
    return m.message?.conversation 
        || m.message?.extendedTextMessage?.text 
        || m.message?.imageMessage?.caption 
        || '';
}

async function extractEvents(apiKey, newMessages) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const messagesText = newMessages.map(m => {
        const ms = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp) * 1000;
        const dateObj = new Date(ms);
        const dateStr = dateObj.toString();
        const isoStr = dateObj.toISOString();
        const text = getMessageText(m);
        const sender = m.pushName || m.key.participant || m.key.remoteJid;
        return `[Local: ${dateStr} | UTC: ${isoStr}] ${sender}: ${text}`;
    }).join('\n');

    const prompt = `
    You are an assistant that analyzes WhatsApp messages to track a newborn baby's schedule.
    Language: Hebrew messages. JSON output in English keys but Hebrew values for details.
    
    Input Messages:
    ${messagesText}
    
    Instructions:
    1. Identify events: Feeding (Bottle/Breast), Sleeping, Waking up, Diaper change, Bath, etc.
    2. For each event, estimate a "Hunger Level" (0-100) *after* the event occurs.
    3. Return a JSON ARRAY of objects.
    4. Format:
       [
         {
           "timestampISO": "2025-12-20T10:00:00+02:00",
           "type": "feeding", // Enum: feeding, sleeping, waking_up, diaper, bath, other
           "details": "120 מ"ל", // Keep in Hebrew
           "hungerLevel": 5
         }
       ]
    5. Details Translation Rules:
       - Keep all details in Hebrew
       - Translate common terms: left breast -> שד ימין, right breast -> שד שמאל, bottle -> בקבוק, poop -> צואה, pee -> שתן, etc.
       - Keep numbers and units (ml, מ"ל, גרם, דקות, שעות)
    6. Timestamp Rules:
       - Use time reference from text if available (combined with message date).
       - Else use message timestamp.
       - MUST include timezone or Z.
    7. Return ONLY valid JSON.
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const response = await result.response;
        let text = response.text();
        text = text.replace(/^\s*```json/g, '').replace(/^\s*```/g, '').replace(/```$/g, '');
        const data = JSON.parse(text);
        
        return data.map(event => {
            let ts = 0;
            if (event.timestampISO) {
                let iso = event.timestampISO;
                if (!iso.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
                    iso += 'Z';
                }
                ts = Date.parse(iso);
            } else if (event.timestamp) {
                ts = event.timestamp;
            }
            return {
                timestamp: ts,
                label: event.details || event.label || event.type,
                details: event.details,
                hungerLevel: event.hungerLevel,
                type: event.type
            };
        });
    } catch (error) {
        console.error("Gemini Error:", error);
        return [];
    }
}

// --- Store Class ---
class SimpleStore {
    constructor() {
        this.chats = {};
        this.messages = {};
        this.contacts = {};
        this.file = STORE_FILE;
    }

    readFromFile() {
        if (fs.existsSync(this.file)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
                this.chats = data.chats || {};
                this.messages = data.messages || {};
                this.contacts = data.contacts || {};
            } catch (err) { console.error('Load store failed:', err); }
        }
    }

    writeToFile() {
        // Simplified write for brevity, full merge logic could be added if needed
        fs.writeFileSync(this.file, JSON.stringify({
            chats: this.chats,
            messages: this.messages,
            contacts: this.contacts
        }, null, 2));
    }

    bind(ev) {
        ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
            (contacts || []).forEach(c => this.contacts[c.id] = { ...this.contacts[c.id], ...c });
            (chats || []).forEach(c => {
                if (!this.chats[c.id]) this.chats[c.id] = { id: c.id, unread: 0, t: 0 };
            });
            (messages || []).forEach(msg => {
                const jid = msg.key.remoteJid;
                if (!this.messages[jid]) this.messages[jid] = [];
                if (!this.messages[jid].find(m => m.key.id === msg.key.id)) {
                    this.messages[jid].push(msg);
                }
            });
        });

        ev.on('contacts.upsert', contacts => {
            contacts.forEach(c => this.contacts[c.id] = { ...this.contacts[c.id], ...c });
        });

        ev.on('messages.upsert', ({ messages, type }) => {
            if (type !== 'notify' && type !== 'append') return;
            messages.forEach(msg => {
                const jid = msg.key.remoteJid;
                if (!this.messages[jid]) this.messages[jid] = [];
                if (!this.messages[jid].find(m => m.key.id === msg.key.id)) {
                    this.messages[jid].push(msg);
                }
            });
        });
    }

    getChatName(jid) {
        const c = this.contacts[jid];
        const chat = this.chats[jid];
        let name = (c?.name) || (c?.notify) || (chat?.name) || (chat?.subject);
        if (!name && jid) name = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        return name;
    }
    
    loadMessage(jid, id) {
        if (this.messages[jid]) {
            return this.messages[jid].find(m => m.key.id === id);
        }
        return null;
    }
}

// --- Agent Class ---
export class NanieAgent {
    constructor(replyMethods) {
        console.log('[NanieAgent] Constructor called');
        this.replyMethods = replyMethods;
        this.store = new SimpleStore();
        this.sock = null;
        this.isInitialized = false;
        this.lastConversationId = null; // Track active conversation for broadcasts
        
        // Start the bot automatically
        this.init().catch(e => console.error('[NanieAgent] Init failed:', e));
    }

    // ... (init and startServer methods remain unchanged)

    async init() {
        if (this.isInitialized) return;
        
        console.log('[NanieAgent] Initializing WhatsApp Bot...');
        this.store.readFromFile();
        
        const cache = loadCache();
        // Ensure API key is set
        if (!cache.apiKey) {
            if (process.env.GEMINI_API_KEY) {
                saveCache({ apiKey: process.env.GEMINI_API_KEY });
            } else {
                 console.warn('[NanieAgent] No Gemini API Key found in cache or env. Events won\'t be extracted.');
            }
        }

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }), // Reduce noise
            browser: Browsers.macOS("Desktop"),
            getMessage: async (key) => {
                if (this.store) {
                    const msg = this.store.loadMessage(key.remoteJid, key.id);
                    return msg ? msg.message : undefined;
                }
                return undefined;
            },
            connectTimeoutMs: 60000,
            emitOwnEvents: true,
            markOnlineOnConnect: true,
        });

        this.store.bind(this.sock.ev);
        this.sock.ev.on('creds.update', saveCreds);
        
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('[NanieAgent] Connection closed, reconnecting:', shouldReconnect);
                if (shouldReconnect) {
                    this.init();
                }
            } else if (connection === 'open') {
                console.log('[NanieAgent] WhatsApp Connected!');
            }
        });

        // Start Web Server for Views
        this.startServer();
        
        // Start Update Loop
        this.updateInterval = setInterval(() => this.updateTimeline(), 60 * 1000);
        this.saveInterval = setInterval(() => this.store.writeToFile(), 10000);
        
        this.isInitialized = true;
    }

    startServer() {
        const app = express();
        app.use(express.json());
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));

        app.get('/', (req, res) => {
            const current = loadCache();
            const gid = current.groupId;
            let chatName = this.store.getChatName(gid);
            if (!chatName && gid === '120363425029379306@g.us') chatName = 'אלה קקי פיפי';
            chatName = chatName || 'היומן של אלה';
            res.render('timeline', { events: current.events, chatName });
        });

        // Internal API for direct sending (optional, since we have handleMessage)
        app.post('/send', async (req, res) => {
            const { text } = req.body;
            if (text) {
                await this.sendMessage(text);
                res.send({ status: 'ok' });
            } else {
                res.status(400).send({ error: 'Missing text' });
            }
        });

        app.listen(PORT, () => {
            console.log(`[NanieAgent] Server running on port ${PORT}`);
        });
    }

    async sendMessage(text) {
        const cache = loadCache();
        const groupId = cache.groupId;

        if (!this.sock) throw new Error('WhatsApp not connected');
        if (!groupId) throw new Error('No group selected');

        console.log(`[NanieAgent] Sending: "${text}" to ${groupId}`);
        await this.sock.sendMessage(groupId, { text });
        
        // Trigger update shortly after
        setTimeout(() => this.updateTimeline(), 2000);
    }

    async updateTimeline() {
        const cache = loadCache();
        let { groupId, apiKey, events, lastMessageTimestamp, processedMsgIds } = cache;
        if (!groupId || !this.store.messages[groupId]) return;

        const allMessages = this.store.messages[groupId] || [];
        const processedSet = new Set(processedMsgIds);
        
        let newMessages = allMessages.filter(m => {
            const msgTime = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp);
            return msgTime > lastMessageTimestamp && !processedSet.has(m.key.id);
        });

        newMessages.sort((a, b) => {
            const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
            const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
            return tB - tA; // Newest first
        });

        if (newMessages.length > 75) newMessages = newMessages.slice(0, 75);

        if (newMessages.length > 0) {
            console.log(`[NanieAgent] Found ${newMessages.length} new messages.`);
            const newEvents = await extractEvents(apiKey || process.env.GEMINI_API_KEY, newMessages);
            
            newMessages.forEach(m => processedMsgIds.push(m.key.id));

            if (newEvents && newEvents.length > 0) {
                console.log(`[NanieAgent] Extracted ${newEvents.length} events.`);
                events = [...events, ...newEvents];
                events.sort((a, b) => a.timestamp - b.timestamp);
                
                const lastMsg = newMessages[newMessages.length - 1];
                lastMessageTimestamp = (typeof lastMsg.messageTimestamp === 'object' ? lastMsg.messageTimestamp.low : lastMsg.messageTimestamp);
                
                saveCache({ events, lastMessageTimestamp, processedMsgIds });

                // BROADCAST TO UI
                if (this.lastConversationId && this.replyMethods && this.replyMethods.send) {
                    console.log(`[NanieAgent] Broadcasting update to ${this.lastConversationId}`);
                    // Send only the new events or just recent ones to save bandwidth
                    // Sending recent 20 ensures UI is consistent
                    const recent = events.slice(-20);
                    await this.replyMethods.send('nanie', this.lastConversationId, {
                        type: 'DATA',
                        data: { events: recent }
                    });
                }

            } else {
                const lastMsg = newMessages[newMessages.length - 1];
                lastMessageTimestamp = (typeof lastMsg.messageTimestamp === 'object' ? lastMsg.messageTimestamp.low : lastMsg.messageTimestamp);
                saveCache({ lastMessageTimestamp, processedMsgIds });
            }
        }
    }

    async getLatestContext() {
        // Return events from cache file
        try {
            const data = await fsPromises.readFile(CACHE_FILE, 'utf-8');
            const json = JSON.parse(data);
            return json.events || [];
        } catch (e) {
            return [];
        }
    }

    async handleMessage(message, replyControl) {
        try {
            const content = typeof message.content === 'string' 
                ? JSON.parse(message.content) 
                : message.content;
            
            // Capture conversation ID for future broadcasts
            if (message.conversation_id) {
                this.lastConversationId = message.conversation_id;
            }

            if (content.action === 'GET_STATUS') {
                 const events = await this.getLatestContext();
                 const recent = events ? events.slice(-20) : [];
                 
                 await replyControl.send({
                    type: 'DATA',
                    data: { events: recent }
                 });
            } else if (content.action === 'ADD_EVENT') {
                const { text } = content;
                if (text) {
                    try {
                        await this.sendMessage(text);
                        console.log('[NanieAgent] Forwarded event to backend');
                        await replyControl.send({ type: 'STATUS', text: 'Event added' });
                    } catch (e) {
                        console.error('[NanieAgent] Failed to forward event:', e);
                        await replyControl.send({ type: 'ERROR', error: e.message });
                    }
                }
            }
        } catch (e) {
            console.error('[NanieAgent] Handle error:', e);
        }
    }
}
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import pino from 'pino';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { GoogleGenAI } from '@google/genai';
import { MappingManager, StorageManager } from './managers.mjs';
import { SimpleStore } from './store.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PORT = 3002;
const MAPPINGS_FILE = path.join(__dirname, 'mappings.json');
const MEMORY_DIR = path.join(__dirname, 'memory');
const STORE_FILE = path.join(__dirname, 'baileys_store.json');
const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

// --- Helper Functions ---
function getMessageText(m) {
    return m.message?.conversation 
        || m.message?.extendedTextMessage?.text 
        || m.message?.imageMessage?.caption 
        || '';
}

export async function extractEvents(apiKey, newMessages, groupName) {
    if (!apiKey) {
        console.error('[NanieAgent] No API Key provided to extractEvents');
        return [];
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const messagesText = newMessages.map(m => {
        const ms = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp) * 1000;
        const dateObj = new Date(ms);
        const dateStr = dateObj.toString(); // Local time with offset (e.g. GMT+0200)
        const isoStr = dateObj.toISOString(); // UTC
        const text = getMessageText(m);
        const sender = m.pushName || m.key.participant || m.key.remoteJid;
        return `[Local: ${dateStr} | UTC: ${isoStr}] ${sender}: ${text}`;
    }).join('\n');

    // Capture offset from first message in batch for fallback correction
    const offsetMatch = messagesText.match(/GMT([+-])(\d{2})(\d{2})/);
    let batchOffsetMs = 0;
    if (offsetMatch) {
        const sign = offsetMatch[1] === '+' ? 1 : -1;
        const hours = parseInt(offsetMatch[2], 10);
        const mins = parseInt(offsetMatch[3], 10);
        batchOffsetMs = sign * (hours * 3600000 + mins * 60000);
    }

    const prompt = `
    Analyze baby tracker messages and extract events.
    Context: Group "${groupName || 'Unknown'}".
    Language: Hebrew messages. JSON output values in Hebrew.
    
    Input Messages:
    ${messagesText}
    
    Instructions:
    1. Identify events: feeding, sleeping, waking_up, diaper, bath, other.
    2. Return a JSON ARRAY of objects.
    3. Format:
       {
         "timestampISO": "ISO_STRING",
         "explicitTime": "HH:MM",  // Extract explicit time from text if present (e.g. "19:30")
         "type": "feeding",
         "details": "..." 
       }
    4. Timestamp Rules (CRITICAL):
       - Case A: Time is EXPLICIT in text (e.g. "ate at 17:00").
         -> Use the Date and Offset from the [Local] timestamp, but replace the time with the extracted time.
         -> Example: Message [Local: ... 12:00:00+02:00], text "17:00" -> Result: "...T17:00:00+02:00"
         -> **NEVER** convert to UTC (Z) for explicit times. ALWAYS preserve the offset (e.g. +02:00).
       
       - Case B: Time is IMPLICIT (no time in text).
         -> COPY the [UTC] timestamp exactly as is, ending in 'Z'. Do NOT change the time or offset.
         -> Example: Message [UTC: 2026-02-13T10:00:00Z] -> Result: "2026-02-13T10:00:00Z"
    `;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            console.log(`[NanieAgent] Sending request to Gemini 2.0-Flash (Attempt ${attempt + 1}/${maxRetries})...
`);
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Gemini API Timeout')), 60000)
            );

            const apiCall = ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { 
                    responseMimeType: "application/json",
                    maxOutputTokens: 8192,
                    responseSchema: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                timestampISO: { type: "STRING" },
                                explicitTime: { type: "STRING" },
                                type: { type: "STRING", enum: ["feeding", "sleeping", "waking_up", "diaper", "bath", "other"] },
                                details: { type: "STRING" }
                            },
                            required: ["timestampISO", "type", "details"]
                        }
                    }
                }
            });

            const result = await Promise.race([apiCall, timeoutPromise]);
            console.log(`[NanieAgent] Received response from Gemini.
`);

            let text = result.response ? result.response.text() : result.text; 
            if (!text && result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts) {
                 text = result.candidates[0].content.parts[0].text;
            }
            
            if (!text) throw new Error('Empty response text');

            text = text.replace(/^\s*```json/g, '').replace(/^\s*```/g, '').replace(/```$/g, '');
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.error(`[NanieAgent] JSON Parse Error. Text: ${text}`);
                throw jsonErr;
            }

            // Map results and validate timestamps
            return data.map(event => {
                let ts = 0;
                if (event.timestampISO) {
                    let iso = event.timestampISO;
                    
                    // --- TIMEZONE BUG CORRECTION LOGIC ---
                    // Fallback: Try to extract time from details if explicitTime is missing
                    let explicitTime = event.explicitTime;
                    
                    if (!explicitTime && event.details) {
                        // Regex to find time patterns: HH:MM, H:MM, HH.MM, H.MM
                        // Avoids matching years (2025) by requiring a separator or context if needed, 
                        // but simple separator check is usually enough for chat logs.
                        const timeRegex = /(?:^|\s)(\d{1,2})[:.](\d{2})(?:\s|$)/; 
                        const m = event.details.match(timeRegex);
                        if (m) {
                             const h = parseInt(m[1], 10);
                             const min = parseInt(m[2], 10);
                             if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
                                 explicitTime = `${h.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`;
                             }
                        }
                    }

                    if (explicitTime && iso.endsWith('Z') && batchOffsetMs !== 0) {
                        const [h, m] = explicitTime.split(':').map(Number);
                        const date = new Date(iso); // Parsed as UTC
                        const utcH = date.getUTCHours();
                        const utcM = date.getUTCMinutes();
                        
                        console.log(`[NanieAgent] Checking TS: ${iso} (UTC ${utcH}:${utcM}) vs Explicit: ${explicitTime} (${h}:${m})`);

                        // If UTC time matches explicit time exactly (allowing small diff for seconds), it's likely wrong.
                        // Example: User said "19:30", Model returned "T19:30:00Z".
                        // 19:30 UTC is 21:30 Israel (Wrong).
                        // We want 19:30 Israel (17:30 UTC).
                        // So we subtract the offset (2 hours).
                        if (utcH === h && Math.abs(utcM - m) < 5) { // Increased tolerance to 5 mins
                            console.warn(`[NanieAgent] Timezone Bug Detected! Explicit: ${explicitTime}, ISO: ${iso}. Applying offset correction: ${-batchOffsetMs}ms`);
                            iso = new Date(date.getTime() - batchOffsetMs).toISOString();
                        }
                    } else if (explicitTime && !iso.endsWith('Z')) {
                         // Case: ISO has offset (e.g. +02:00) but might still be wrong if model messed up the calculation.
                         // But usually if offset is present, model is trying to be smart. 
                         // We trust specific offset unless it contradicts explicit time wildly.
                         // For now, we only fix the "Z" case which is the confirmed bug.
                    }
                    // -------------------------------------

                    ts = Date.parse(iso);
                }

                // Final safety fallback
                if (!ts || isNaN(ts)) {
                    ts = Date.now();
                }

                return {
                    timestamp: ts,
                    label: event.details || event.type,
                    details: event.details,
                    type: event.type
                };
            }).filter(e => e.timestamp > 0);
        } catch (error) {
            const isRetryable = error.message === 'Gemini API Timeout' ||
                                error.status === 429 || error.status === 503 ||
                                (error.message && (
                                    error.message.includes('429') || 
                                    error.message.includes('503') ||
                                    error.message.includes('UNAVAILABLE') ||
                                    error.message.includes('Failed to parse stream') ||
                                    error.message.includes('fetch failed')
                                ));

            if (isRetryable) {
                attempt++;
                const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
                console.warn(`[NanieAgent] Transient error (${error.message}). Retrying in ${Math.round(delay)}ms (Attempt ${attempt}/${maxRetries})...
`);
                if (attempt >= maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("Gemini Error:", error);
                throw error;
            }
        }
    }
    throw new Error('Max retries exceeded');
}

class PendingQueueManager {
    constructor(filePath) {
        this.filePath = filePath;
        this.queue = [];
    }

    async load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = await fsPromises.readFile(this.filePath, 'utf-8');
                this.queue = JSON.parse(data);
            }
        } catch (e) {
            console.error('[PendingQueue] Load failed:', e);
            this.queue = [];
        }
    }

    async save() {
        try {
            await fsPromises.writeFile(this.filePath, JSON.stringify(this.queue, null, 2));
        } catch (e) {
            console.error('[PendingQueue] Save failed:', e);
        }
    }

    add(item) {
        this.queue.push(item);
        return this.save();
    }

    remove(id) {
        this.queue = this.queue.filter(i => i.id !== id);
        return this.save();
    }

    getAll() {
        return [...this.queue];
    }
}

// --- Agent Class ---
export class NanieAgent {
    constructor(replyMethods) {
        console.log('[NanieAgent] Constructor called - V4.0 (Batch 100, Serial Lock)');
        this.replyMethods = replyMethods;
        this.isConnected = false;
        
        // --- Managers ---
        this.mappingManager = new MappingManager(MAPPINGS_FILE);
        this.storageManager = new StorageManager(MEMORY_DIR);
        this.pendingQueueManager = new PendingQueueManager(path.join(MEMORY_DIR, 'pending_events.json'));
        this.store = new SimpleStore(STORE_FILE);
        
        this.sock = null;
        this.isInitialized = false;
        this.updateTimeouts = new Map();
        this.processingGroups = new Set(); // Serial Lock
        this.recentlySentMsgIds = new Set(); // Track sent messages to avoid processing duplicates
        
        this.ready = this.init().catch(e => console.error('[NanieAgent] Init failed:', e));
    }

    async init() {
        if (this.isInitialized) return;
        
        console.log('[NanieAgent] Initializing V4.0...');
        await this.mappingManager.load();
        await this.pendingQueueManager.load();
        this.store.readFromFile();
        
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

        this.sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'silent' }),
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
            syncFullHistory: true,
        });

        this.store.bind(this.sock.ev);
        this.sock.ev.on('creds.update', saveCreds);
        
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('[NanieAgent] Connection closed, reconnecting:', shouldReconnect);
                this.isConnected = false;
                if (shouldReconnect) {
                    this.init();
                }
            } else if (connection === 'open') {
                console.log('[NanieAgent] WhatsApp Connected! V4.2');
                this.isConnected = true;
                // Force sync for mapped groups on connection
                const mappings = this.mappingManager.getAll();
                const uniqueGroups = new Set(Object.values(mappings).map(m => m.groupId));
                for (const gid of uniqueGroups) {
                    console.log(`[NanieAgent] Performing initial sync for ${gid}`);
                    this.updateGroupTimeline(gid, null, null, false, 500).catch(e => console.error(e));
                }
            }
        });

        // Start Web Server for Views
        this.startServer();
        
        // Start Update Loop (Global, iterates all groups)
        this.runUpdateLoop();
        this.saveInterval = setInterval(() => this.store.writeToFile(), 10000);
        
        this.isInitialized = true;
    }

    startServer() {
        const app = express();
        app.use(express.json());
        app.set('view engine', 'ejs');
        app.set('views', path.join(__dirname, 'views'));

        app.get('/', async (req, res) => {
            const mappings = this.mappingManager.getAll();
            const firstConvId = Object.keys(mappings)[0];
            
            if (firstConvId) {
                const { groupId, groupName } = mappings[firstConvId];
                const events = await this.storageManager.getTimeline(groupId);
                res.render('timeline', { events, chatName: groupName || this.store.getChatName(groupId) });
            } else {
                res.render('timeline', { events: [], chatName: 'No Groups Mapped' });
            }
        });

        app.listen(PORT, () => {
            console.log(`[NanieAgent] Server running on port ${PORT}`);
        });
    }

    async waitForSocket() {
        if (this.isConnected) return;
        console.log('[NanieAgent] Waiting for connection...');
        let attempts = 0;
        while (!this.isConnected && attempts < 15) { 
             await new Promise(r => setTimeout(r, 2000));
             attempts++;
        }
        if (!this.isConnected) throw new Error('Timeout waiting for WhatsApp connection');
    }

    async sendMessage(groupId, text) {
        await this.waitForSocket();
        if (!this.sock) throw new Error('WhatsApp not initialized');
        
        console.log(`[NanieAgent] Sending: "${text}" to ${groupId}`);
        const msg = await this.sock.sendMessage(groupId, { text });
        
        if (msg && msg.key && msg.key.id) {
             this.recentlySentMsgIds.add(msg.key.id);
        }
        
        setTimeout(() => this.updateGroupTimeline(groupId), 2000);
        return msg;
    }

    async runUpdateLoop() {
        try {
            await this.processPendingQueue();
            await this.updateAllTimelines();
        } catch (e) {
            console.error('[NanieAgent] Update loop error:', e);
        }
        this.updateTimeout = setTimeout(() => this.runUpdateLoop(), 60 * 1000);
    }

    async broadcastTimeline(groupId) {
        if (!this.replyMethods || !this.replyMethods.send) return;
        
        const conversationIds = this.mappingManager.getConversationIds(groupId);
        if (conversationIds.length === 0) return;

        const timeline = await this.storageManager.getTimeline(groupId);
        const recent = timeline.slice(-20);
        
        // Find group name once
        let groupName = null;
        if (conversationIds.length > 0) {
             const mapping = this.mappingManager.getGroup(conversationIds[0]);
             groupName = mapping ? mapping.groupName : this.store.getChatName(groupId);
        }

        for (const convId of conversationIds) {
            await this.replyMethods.send('nanie', convId, { type: 'DATA', data: { events: recent, groupName } });
        }
    }

    async processPendingQueue() {
        const pending = this.pendingQueueManager.getAll();
        if (pending.length === 0) return;

        console.log(`[NanieAgent] Processing ${pending.length} pending events...`);
        
        // We only retry if we have a connection (or try to connect)
        // But we shouldn't block indefinitely.
        if (!this.isConnected) {
             console.log('[NanieAgent] Offline, skipping pending queue processing.');
             return;
        }

        const groupsToUpdate = new Set();

        for (const item of pending) {
            try {
                // Try to send
                console.log(`[NanieAgent] Retrying pending event ${item.id}...`);
                await this.sendMessage(item.groupId, item.text);
                
                // If successful:
                await this.storageManager.updateEvent(item.groupId, item.id, { synced: true });
                await this.pendingQueueManager.remove(item.id);
                groupsToUpdate.add(item.groupId);
                console.log(`[NanieAgent] Pending event ${item.id} synced successfully.`);
            } catch (e) {
                console.error(`[NanieAgent] Failed to retry event ${item.id}:`, e.message);
                // Keep in queue, try next time
            }
        }

        // Broadcast updates for affected groups
        for (const groupId of groupsToUpdate) {
            await this.broadcastTimeline(groupId);
        }
    }

    async updateAllTimelines() {
        const mappings = this.mappingManager.getAll();
        const groups = new Set();
        for (const [convId, data] of Object.entries(mappings)) {
            groups.add(data.groupId);
        }
        
        for (const groupId of groups) {
            await this.updateGroupTimeline(groupId);
        }
    }

    async updateGroupTimeline(groupId, conversationId = null, groupName = null, force = false, limit = 50) {
        // Serial Lock check
        if (this.processingGroups.has(groupId)) {
            console.log(`[NanieAgent] Group ${groupId} update already in progress. Skipping.`);
            return;
        }
        this.processingGroups.add(groupId);

        try {
            const conversationIds = this.mappingManager.getConversationIds(groupId);
            if (conversationId && !conversationIds.includes(conversationId)) {
                conversationIds.push(conversationId);
            }

            if (conversationIds.length === 0) {
                this.processingGroups.delete(groupId);
                return;
            }
            if (!this.store.messages[groupId]) {
                this.processingGroups.delete(groupId);
                return;
            }

            const metadata = await this.storageManager.getMetadata(groupId);
            const lastMessageTimestamp = force ? 0 : (metadata.lastMessageTimestamp || 0);
            const processedMsgIds = force ? new Set() : new Set(metadata.processedMsgIds || []);

            const allMessages = this.store.messages[groupId] || [];
            const nowSeconds = Math.floor(Date.now() / 1000);
            const sixtyDaysAgo = nowSeconds - (60 * 24 * 60 * 60);

            let newMessages = allMessages.filter(m => {
                const msgTime = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp);
                const isRecentEnough = msgTime > sixtyDaysAgo;
                return !processedMsgIds.has(m.key.id) && (force || msgTime > lastMessageTimestamp || isRecentEnough);
            });

            if (newMessages.length === 0 && limit <= 50) {
                 // Nothing new, no need to log start
                 this.processingGroups.delete(groupId);
                 return;
            }

            console.log(`[NanieAgent] updateGroupTimeline start for ${groupId} (Limit: ${limit}, New: ${newMessages.length})`);

            // Sort Ascending (Oldest first) for chronological processing
            newMessages.sort((a, b) => {
                const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
                const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
                return tA - tB; 
            });

            // If we have more than the limit, take the LATEST 'limit' messages, but keep them chronological
            if (newMessages.length > limit) {
                newMessages = newMessages.slice(-limit);
            }

            let timelineUpdated = false;

            if (newMessages.length > 0) {
            console.log(`[NanieAgent] Found ${newMessages.length} new messages for ${groupId}. V4.2 Processing (Batch size 50)...`);
            const apiKey = process.env.GEMINI_API_KEY;
            
            const BATCH_SIZE = 50;
            let allExtractedEvents = [];
            let runningProcessedIds = new Set(processedMsgIds); 
            let currentLastTimestamp = lastMessageTimestamp;

            for (let i = 0; i < newMessages.length; i += BATCH_SIZE) {
                const batch = newMessages.slice(i, i + BATCH_SIZE);
                
                const tFirst = (typeof batch[0].messageTimestamp === 'object' ? batch[0].messageTimestamp.low : batch[0].messageTimestamp);
                const tLast = (typeof batch[batch.length-1].messageTimestamp === 'object' ? batch[batch.length-1].messageTimestamp.low : batch[batch.length-1].messageTimestamp);
                console.log(`[NanieAgent] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newMessages.length / BATCH_SIZE)} (${batch.length} msgs) - Range: ${new Date(tFirst * 1000).toLocaleString()} to ${new Date(tLast * 1000).toLocaleString()}`);
                
                let success = false;
                let batchAttempt = 0;
                
                while (!success) {
                    batchAttempt++;
                    try {
                        // Filter out messages we sent ourselves (already processed immediately)
                        const messagesToExtract = batch.filter(m => !this.recentlySentMsgIds.has(m.key.id));
                        
                        let batchEvents = [];
                        if (messagesToExtract.length > 0) {
                             batchEvents = await extractEvents(apiKey, messagesToExtract, groupName);
                        }

                        if (batchEvents && batchEvents.length > 0) {
                            allExtractedEvents.push(...batchEvents);
                            await this.storageManager.appendEvents(groupId, batchEvents);
                        }
                        
                        // CHECKPOINT: Update processed IDs immediately
                        const batchIds = batch.map(m => m.key.id);
                        batchIds.forEach(id => {
                            runningProcessedIds.add(id);
                            this.recentlySentMsgIds.delete(id);
                        });

                        const batchNewestTs = (typeof batch[batch.length - 1].messageTimestamp === 'object' ? batch[batch.length - 1].messageTimestamp.low : batch[batch.length - 1].messageTimestamp);
                        currentLastTimestamp = Math.max(currentLastTimestamp, batchNewestTs);

                        const updates = {
                            processedMsgIds: Array.from(runningProcessedIds),
                            lastMessageTimestamp: currentLastTimestamp
                        };
                        
                        await this.storageManager.updateMetadata(groupId, updates);
                        timelineUpdated = true;
                        success = true;

                    } catch (e) {
                        console.error(`[NanieAgent] Batch failed (Attempt ${batchAttempt}). Error:`, e);
                        const delay = Math.min(Math.pow(2, batchAttempt) * 2500, 60000);
                        console.log(`[NanieAgent] Retrying batch in ${Math.round(delay/1000)}s...`);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }

                if (i + BATCH_SIZE < newMessages.length) {
                    console.log("[NanieAgent] Cooling down for 5s...");
                    await new Promise(r => setTimeout(r, 5000)); 
                }
            }
            
            if (timelineUpdated && this.replyMethods && this.replyMethods.send) {
                const timeline = await this.storageManager.getTimeline(groupId);
                const recent = force ? timeline.slice(-100) : timeline.slice(-20); 
                for (const convId of conversationIds) {
                    const mapping = this.mappingManager.getGroup(convId);
                    const name = groupName || (mapping ? mapping.groupName : null);
                    await this.replyMethods.send('nanie', convId, { type: 'DATA', data: { events: recent, groupName: name } });
                }
            } else if (conversationId && this.replyMethods && this.replyMethods.send) {
                 const timeline = await this.storageManager.getTimeline(groupId);
                 const recent = force ? timeline.slice(-100) : timeline.slice(-20);
                 const mapping = this.mappingManager.getGroup(conversationId);
                 const name = groupName || (mapping ? mapping.groupName : null);
                 await this.replyMethods.send('nanie', conversationId, { type: 'DATA', data: { events: recent, groupName: name } });
            }
        } // End if newMessages > 0
        } finally {
            this.processingGroups.delete(groupId);
        }
    }

    async getContext(conversationId) {
        await this.ready;
        const mapping = this.mappingManager.getGroup(conversationId);
        if (!mapping) return [];
        return await this.storageManager.getTimeline(mapping.groupId);
    }

    async getContextSnapshot(conversationId) {
        await this.ready;
        const mapping = this.mappingManager.getGroup(conversationId);
        if (!mapping) return null;
        return await this.storageManager.getContextSnapshot(mapping.groupId);
    }

    async getRecentMessages(conversationId, limit = 50) {
        await this.ready;
        const mapping = this.mappingManager.getGroup(conversationId);
        if (!mapping) return [];
        const { groupId } = mapping;
        const messages = this.store.messages[groupId] || [];
        const sorted = [...messages].sort((a, b) => {
             const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
             const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
             return tA - tB;
        });
        const recent = sorted.slice(-limit);
        return recent.map(m => {
            const ts = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp) * 1000;
            const sender = m.pushName || m.key.participant || m.key.remoteJid;
            const text = getMessageText(m);
            return { timestamp: ts, sender, text };
        });
    }

    async handleMessage(message, replyControl) {
        console.log(`[NanieAgent] Handling message: ${message.id} (Action: ${typeof message.content === 'string' ? 'parsing...' : 'object'})`);
        await this.ready;
        console.log(`[NanieAgent] Agent ready for ${message.id}`);
        try {
            const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
            const conversationId = message.conversation_id;
            console.log(`[NanieAgent] Action: ${content.action} for ${conversationId}`);
            
            if (content.action === 'LIST_GROUPS') {
                 const groups = this.store.getGroups();
                 console.log(`[NanieAgent] Returning ${groups.length} groups`);
                 await replyControl.send({ type: 'DATA', data: { groups } });
                 return;
            }
            if (content.action === 'SELECT_GROUP') {
                 const { groupId, groupName } = content;
                 const availableGroups = this.store.getGroups();
                 const isValid = availableGroups.find(g => g.id === groupId);
                 if (!isValid) { await replyControl.send({ type: 'ERROR', error: 'Invalid Group ID' }); return; }
                 await this.mappingManager.setMapping(conversationId, { groupId, groupName, mappedAt: Date.now() });
                 await this.updateGroupTimeline(groupId, conversationId, groupName, false, 500);
                 await replyControl.send({ type: 'STATUS', text: 'LINKED' });
                 return;
            }
            if (content.action === 'DELETE_CONVERSATION') {
                const mapping = this.mappingManager.getGroup(conversationId);
                if (mapping) {
                    const { groupId } = mapping;
                    await this.mappingManager.deleteMapping(conversationId);
                    console.log(`[NanieAgent] Unmapped conversation ${conversationId} from group ${groupId}`);
                    
                    // Check if any other conversation still uses this groupId
                    const otherConvs = this.mappingManager.getConversationIds(groupId);
                    if (otherConvs.length === 0) {
                        console.log(`[NanieAgent] No more conversations for group ${groupId}. Cleaning up memory...`);
                        try {
                            const groupDir = path.join(MEMORY_DIR, groupId);
                            if (fs.existsSync(groupDir)) {
                                await fsPromises.rm(groupDir, { recursive: true, force: true });
                                console.log(`[NanieAgent] Deleted memory for group ${groupId}`);
                            }
                        } catch (e) {
                             console.error(`[NanieAgent] Failed to clean up memory for ${groupId}:`, e);
                        }
                    }
                }
                return;
            }
            const mapping = this.mappingManager.getGroup(conversationId);
            if (!mapping) {
                console.log(`[NanieAgent] No mapping for ${conversationId}. Sending GROUP_SELECTION_REQUIRED.`);
                await replyControl.send({ type: 'SYSTEM', code: 'GROUP_SELECTION_REQUIRED', error: 'Group Selection Required', message: 'Please select a WhatsApp group to continue.' });
                return;
            }
            const { groupId, groupName } = mapping;
            if (content.action === 'GET_STATUS') {
                 const timeline = await this.storageManager.getTimeline(groupId);
                 await replyControl.send({ type: 'DATA', data: { events: timeline.slice(-20), groupName } });
            } else if (content.action === 'RESYNC_HISTORY') {
                const chatMessages = this.store.messages[groupId] || [];
                if (chatMessages.length > 0) {
                    chatMessages.sort((a, b) => {
                         const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
                         const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
                         return tA - tB;
                    });
                    const oldest = chatMessages[0];
                    const oldestTs = (typeof oldest.messageTimestamp === 'object' ? oldest.messageTimestamp.low : oldest.messageTimestamp);
                    try { await this.sock.fetchMessageHistory(100, oldest.key, oldestTs); } catch (e) {}
                }
                await this.updateGroupTimeline(groupId, conversationId, groupName, true, 500);
                await replyControl.send({ type: 'STATUS', text: 'HISTORY_RESYNCED' });
            } else if (content.action === 'ADD_EVENT') {
                const { text, eventData } = content;
                if (text) {
                    try { 
                        let eventId = crypto.randomUUID();
                        
                        // 1. Process structured event immediately
                        if (eventData) {
                            const newEvent = {
                                id: eventId,
                                timestamp: eventData.timestamp || Date.now(),
                                label: eventData.details || eventData.type,
                                details: eventData.details,
                                type: eventData.type,
                                synced: false // Initially false
                            };
                            await this.storageManager.appendEvents(groupId, [newEvent]);
                            
                            // Add to pending queue
                            await this.pendingQueueManager.add({
                                id: eventId,
                                groupId,
                                text,
                                timestamp: Date.now()
                            });

                            // Broadcast update to UI immediately (shows as pending)
                            const timeline = await this.storageManager.getTimeline(groupId);
                            await replyControl.send({ type: 'DATA', data: { events: timeline.slice(-20) } });
                        }

                        // 2. Try to process queue immediately (best effort)
                        this.processPendingQueue().catch(err => console.error('[NanieAgent] Immediate sync failed:', err));

                        await replyControl.send({ type: 'STATUS', text: 'Event added' }); 
                    } catch (e) { 
                        console.error('[NanieAgent] ADD_EVENT error:', e);
                        await replyControl.send({ type: 'ERROR', error: e.message }); 
                    }
                }
            } else if (content.action === 'RETRY_SYNC') {
                 const { eventId } = content;
                 if (eventId) {
                     // Check if already in queue
                     const pending = this.pendingQueueManager.getAll();
                     const exists = pending.find(p => p.id === eventId);
                     
                     if (!exists) {
                         // Fetch from store and re-queue
                         const timeline = await this.storageManager.getTimeline(groupId);
                         const event = timeline.find(e => e.id === eventId);
                         if (event) {
                             // Reconstruct text
                             // Improved reconstruction logic
                             const typeMap = {
                                'feeding': 'האכלה',
                                'sleeping': 'שינה',
                                'waking_up': 'התעוררות',
                                'diaper': 'חיתול',
                                'bath': 'מקלחת',
                                'other': 'אחר'
                             };
                             
                             let label = event.details || event.label || '';
                             const hebrewType = typeMap[event.type] || event.type;
                             
                             // Add time if available
                             const timeStr = new Date(event.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
                             const prefix = `בשעה ${timeStr}`;

                             let text = `${prefix} ${hebrewType} ${label}`.trim();
                             if (event.type === 'feeding' && !text.includes('האכלה') && !label.includes('האכלה')) {
                                 text = `${prefix} האכלה ${label}`.trim();
                             }
                             
                             await this.pendingQueueManager.add({
                                 id: eventId,
                                 groupId,
                                 text: text,
                                 timestamp: Date.now()
                             });
                             console.log(`[NanieAgent] Re-queued event ${eventId} for sync. Text: ${text}`);
                         }
                     }
                 }
                 
                 // Trigger processing
                 this.processPendingQueue();
                 await replyControl.send({ type: 'STATUS', text: 'Sync initiated' });
            }
        } catch (e) { console.error('[NanieAgent] Handle error:', e); }
    }
}
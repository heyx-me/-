import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
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
         "timestampISO": "2025-12-20T10:00:00+02:00",
         "type": "feeding",
         "details": "120 מ\"ל" 
       }
    4. Timestamp Rules:
       - **PRIORITY:** If the text mentions a time (e.g. "ate at 10:00"), use that time combined with the DATE and TIMEZONE from the message's [Local] timestamp.
       - Result MUST be a full ISO 8601 string with the correct offset (e.g., +02:00 or +03:00).
       - If NO time is mentioned in text, use the exact [UTC] timestamp provided in the input (suffix with 'Z').
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
                    // Fallback to UTC if model omits offset/Z - REMOVED to allow local parsing
                    // if (!iso.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
                    //    iso += 'Z';
                    // }
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

// --- Agent Class ---
export class NanieAgent {
    constructor(replyMethods) {
        console.log('[NanieAgent] Constructor called - V4.0 (Batch 100, Serial Lock)');
        this.replyMethods = replyMethods;
        
        // --- Managers ---
        this.mappingManager = new MappingManager(MAPPINGS_FILE);
        this.storageManager = new StorageManager(MEMORY_DIR);
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
                if (shouldReconnect) {
                    this.init();
                }
            } else if (connection === 'open') {
                console.log('[NanieAgent] WhatsApp Connected! V4.2');
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

    async sendMessage(groupId, text) {
        if (!this.sock) throw new Error('WhatsApp not connected');
        
        console.log(`[NanieAgent] Sending: "${text}" to ${groupId}`);
        await this.sock.sendMessage(groupId, { text });
        
        setTimeout(() => this.updateGroupTimeline(groupId), 2000);
    }

    async runUpdateLoop() {
        try {
            await this.updateAllTimelines();
        } catch (e) {
            console.error('[NanieAgent] Update loop error:', e);
        }
        this.updateTimeout = setTimeout(() => this.runUpdateLoop(), 60 * 1000);
    }

    async updateAllTimelines() {
        const mappings = this.mappingManager.getAll();
        for (const [convId, data] of Object.entries(mappings)) {
            await this.updateGroupTimeline(data.groupId, convId, data.groupName);
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
            console.log(`[NanieAgent] updateGroupTimeline start for ${groupId} (Limit: ${limit})`);
            const conversationIds = this.mappingManager.getConversationIds(groupId);
            if (conversationId && !conversationIds.includes(conversationId)) {
                conversationIds.push(conversationId);
            }

            if (conversationIds.length === 0) return;
            if (!this.store.messages[groupId]) return;

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
                    await this.mappingManager.deleteMapping(conversationId);
                    console.log(`[NanieAgent] Unmapped conversation ${conversationId} from group ${mapping.groupId}`);
                    // Optionally, we could clean up storage if no other conversations map to this group,
                    // but for now, we keep the group data as other conversations might use it or re-link.
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
                        // 1. Process structured event immediately if available
                        if (eventData) {
                            const newEvent = {
                                timestamp: eventData.timestamp || Date.now(),
                                label: eventData.details || eventData.type,
                                details: eventData.details,
                                type: eventData.type
                            };
                            await this.storageManager.appendEvents(groupId, [newEvent]);
                            
                            // Broadcast update to UI immediately
                            const timeline = await this.storageManager.getTimeline(groupId);
                            await replyControl.send({ type: 'DATA', data: { events: timeline.slice(-20) } });
                        }

                        // 2. Send to WhatsApp and track ID to avoid duplicate processing
                        if (this.sock) {
                            console.log(`[NanieAgent] Sending: "${text}" to ${groupId}`);
                            const sentMsg = await this.sock.sendMessage(groupId, { text });
                            if (sentMsg && sentMsg.key && sentMsg.key.id) {
                                this.recentlySentMsgIds.add(sentMsg.key.id);
                            }
                            // Trigger background sync to persist processed status eventually
                            setTimeout(() => this.updateGroupTimeline(groupId), 2000);
                        } else {
                            throw new Error('WhatsApp not connected');
                        }

                        await replyControl.send({ type: 'STATUS', text: 'Event added' }); 
                    } catch (e) { 
                        console.error('[NanieAgent] ADD_EVENT error:', e);
                        await replyControl.send({ type: 'ERROR', error: e.message }); 
                    }
                }
            }
        } catch (e) { console.error('[NanieAgent] Handle error:', e); }
    }
}
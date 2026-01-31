const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const readline = require('readline');
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const os = require('os');

// ==============================================================================
// CONFIGURATION & CACHE
// ==============================================================================
const CACHE_FILE = './ella_cache.json';
const STORE_FILE = './baileys_store.json';
const PORT = 3000;

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
        // Migration/Defaults
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
    // We merge carefully to avoid overwriting arrays if we passed partial data
    // But usually we pass the full updated state or specific keys.
    // If 'events' is passed, it overwrites.
    const toSave = { ...current, ...data };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(toSave, null, 2));
}

// ==============================================================================
// STORE IMPLEMENTATION
// ==============================================================================
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

    syncFromFile() {
        if (!fs.existsSync(this.file)) return;
        try {
            const raw = fs.readFileSync(this.file, 'utf-8');
            const diskData = JSON.parse(raw);

            // Merge Contacts
            this.contacts = { ...diskData.contacts, ...this.contacts };
            
            // Merge Chats
            this.chats = { ...diskData.chats, ...this.chats };

            // Merge Messages
            const diskMessages = diskData.messages || {};
            const allJids = new Set([...Object.keys(this.messages), ...Object.keys(diskMessages)]);
            
            allJids.forEach(jid => {
                const localMsgs = this.messages[jid] || [];
                const diskMsgs = diskMessages[jid] || [];
                
                const msgMap = new Map();
                // Add disk first
                diskMsgs.forEach(m => {
                    if (m && m.key && m.key.id) msgMap.set(m.key.id, m);
                });
                // Add local second (overwrites duplicates with local state if any, preserves unsaved local msgs)
                localMsgs.forEach(m => {
                    if (m && m.key && m.key.id) msgMap.set(m.key.id, m);
                });

                this.messages[jid] = Array.from(msgMap.values()).sort((a, b) => {
                     const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp) || 0;
                     const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp) || 0;
                     return tA - tB;
                });
            });
        } catch (err) {
            console.error('Sync from file failed:', err);
        }
    }

    writeToFile() {
        let diskData = { chats: {}, messages: {}, contacts: {} };
        try {
            if (fs.existsSync(this.file)) {
                const raw = fs.readFileSync(this.file, 'utf-8');
                diskData = JSON.parse(raw);
            }
        } catch (err) {
            console.error('Read before write failed:', err);
        }

        // Merge Contacts
        const mergedContacts = { ...(diskData.contacts || {}), ...this.contacts };

        // Merge Chats
        const mergedChats = { ...(diskData.chats || {}), ...this.chats };

        // Merge Messages
        const mergedMessages = { ...(diskData.messages || {}) };
        for (const jid in this.messages) {
            const localMsgs = this.messages[jid] || [];
            const diskMsgs = mergedMessages[jid] || [];

            // Deduplicate by key.id using a Map
            const msgMap = new Map();
            
            // Load disk messages first
            diskMsgs.forEach(m => {
                if (m && m.key && m.key.id) msgMap.set(m.key.id, m);
            });

            // Overlay local messages
            localMsgs.forEach(m => {
                if (m && m.key && m.key.id) msgMap.set(m.key.id, m);
            });

            // Convert back to array and sort
            mergedMessages[jid] = Array.from(msgMap.values()).sort((a, b) => {
                const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp) || 0;
                const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp) || 0;
                return tA - tB;
            });
        }

        fs.writeFileSync(this.file, JSON.stringify({
            chats: mergedChats,
            messages: mergedMessages,
            contacts: mergedContacts
        }, null, 2));
    }

    bind(ev) {
        ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
            (contacts || []).forEach(c => this.contacts[c.id] = { ...this.contacts[c.id], ...c });
            (chats || []).forEach(c => {
                if (!this.chats[c.id]) this.chats[c.id] = { id: c.id, unread: 0, t: 0 };
                const t = c.conversationTimestamp;
                if (t) this.chats[c.id].t = typeof t === 'object' ? t.low : t;
            });
            (messages || []).forEach(msg => {
                const jid = msg.key.remoteJid;
                if (!this.messages[jid]) this.messages[jid] = [];
                // Deduplicate
                if (!this.messages[jid].find(m => m.key.id === msg.key.id)) {
                    this.messages[jid].push(msg);
                }
            });
            console.log(`DEBUG: messaging-history.set processed. Messages count: ${(messages || []).length}`);
        });

        ev.on('contacts.upsert', contacts => {
            contacts.forEach(c => this.contacts[c.id] = { ...this.contacts[c.id], ...c });
        });

        ev.on('chats.upsert', newChats => {
            newChats.forEach(c => {
                if (!this.chats[c.id]) this.chats[c.id] = { id: c.id, unread: 0, t: 0 };
                Object.assign(this.chats[c.id], c);
            });
        });

        ev.on('messages.upsert', ({ messages, type }) => {
            console.log(`DEBUG: messages.upsert type=${type} count=${messages.length}`);
            if (type !== 'notify' && type !== 'append') return;
            messages.forEach(msg => {
                const jid = msg.key.remoteJid;
                if (!this.messages[jid]) this.messages[jid] = [];
                if (!this.messages[jid].find(m => m.key.id === msg.key.id)) {
                    this.messages[jid].push(msg);
                }
                if (!this.chats[jid]) this.chats[jid] = { id: jid, unread: 0, t: 0 };
                const t = msg.messageTimestamp;
                this.chats[jid].t = typeof t === 'object' ? t.low : t;
            });
        });
    }

    getChatName(jid) {
        const c = this.contacts[jid];
        const chat = this.chats[jid];
        let name = (c?.name) || (c?.notify) || (chat?.name) || (chat?.subject);
        if (!name) name = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        return name;
    }

    loadMessage(jid, id) {
        if (this.messages[jid]) {
            return this.messages[jid].find(m => m.key.id === id);
        }
        return null;
    }
}

const store = new SimpleStore();
store.readFromFile();

// ==============================================================================
// UTILS
// ==============================================================================
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => rl.question(question, resolve));
}

function getMessageText(m) {
    return m.message?.conversation 
        || m.message?.extendedTextMessage?.text 
        || m.message?.imageMessage?.caption 
        || '';
}

// ==============================================================================
// GEMINI INTEGRATION
// ==============================================================================
async function extractEvents(apiKey, newMessages) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const messagesText = newMessages.map(m => {
        const ms = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp) * 1000;
        const dateObj = new Date(ms);
        const dateStr = dateObj.toString(); // Local time with offset
        const isoStr = dateObj.toISOString(); // UTC
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
           "details": "120 מ\"ל", // Specific details extracted from text, keep in Hebrew, include units, keep it short
           "hungerLevel": 5
         }
       ]
    5. Details Translation Rules:
       - Keep all details in Hebrew
       - Translate common terms: left breast -> שד ימין, right breast -> שד שמאל, bottle -> בקבוק, poop -> צואה, pee -> שתן, etc.
       - Keep numbers and units (ml, מ\"ל, גרם, דקות, שעות)
       - Examples: "left breast 15 min" -> "שד ימין 15 דקות", "120ml bottle" -> "120 מ\"ל בקבוק", "poop" -> "צואה"
    6. Timestamp Rules:
       - **PRIORITY:** If the message text contains a time reference, YOU MUST use THAT time combined with the **Date** and **Timezone** from the message timestamp (Local time).
       - Detect time formats like: "HH:mm", "HHmm", or simply "HH" (e.g., "14:00", "1400", "14").
       - Example: Message Local "Sat Dec 20 15:00...", Text "14 poop" -> Interpret as 14:00. Result: "2025-12-20T14:00:00+02:00" (assuming +02:00 is the local offset).
       - Example: "ate at 10" -> Interpret as 10:00.
       - IF no time is found in text, use the provided UTC timestamp from the input. YOU MUST include the 'Z' suffix (e.g., "2025-12-20T10:00:00Z").
       - NEVER return a timestamp without a timezone offset (+HH:mm) or 'Z' suffix.
       - Crucially, the output ISO string MUST reflect the correct instance in time.
    7. Return ONLY valid JSON.
    `;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });
        const response = await result.response;
        let text = response.text();
        console.log("Gemini Response:", text); // Log for debugging
        // Clean markdown
        text = text.replace(/^\s*```json/g, '').replace(/^\s*```/g, '').replace(/```$/g, '');
        const data = JSON.parse(text);
        
        // Post-process to convert ISO to timestamp
        return data.map(event => {
            let ts = 0;
            if (event.timestampISO) {
                let iso = event.timestampISO;
                // If it looks like it's missing a timezone, default to UTC to be safe (as per UTC input)
                if (!iso.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(iso)) {
                    iso += 'Z';
                }
                ts = Date.parse(iso);
            } else if (event.timestamp) {
                ts = event.timestamp; // Fallback if model uses old key
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

// ==============================================================================
// MAIN
// ==============================================================================
async function main() {
    let { groupId, apiKey, events, lastMessageTimestamp, processedMsgIds } = loadCache();

    // 1. Setup API Key
    if (!apiKey) {
        apiKey = await ask('Enter your Gemini API Key: ');
        saveCache({ apiKey });
    }

    // 2. Connect WhatsApp
    console.log('Connecting to WhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    let sock;

    const connectToWhatsApp = async () => {
        const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: false }));
        console.log(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

        const socket = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: true,
            logger: pino({ level: 'info' }),
            browser: Browsers.macOS("Desktop"),
            getMessage: async (key) => {
                if (store) {
                    const msg = store.loadMessage(key.remoteJid, key.id);
                    return msg ? msg.message : undefined;
                }
                return undefined;
            },
            // fast retry for frequent disconnects
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: true,
            markOnlineOnConnect: true,
        });

        store.bind(socket.ev);
        socket.ev.on('creds.update', saveCreds);

        socket.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                if (shouldReconnect) {
                    connectToWhatsApp();
                } else {
                    console.log('Connection closed. You are logged out.');
                    process.exit(0);
                }
            } else if (connection === 'open') {
                console.log('WhatsApp Connected!');
            }
        });

        sock = socket;
        return socket;
    };

    await connectToWhatsApp();

    // Wait for open state helper
    const waitForConnection = async () => {
        if (sock?.ws?.isOpen) return;
        await new Promise(resolve => {
            const listener = (update) => {
                if (update.connection === 'open') {
                    sock.ev.off('connection.update', listener);
                    resolve();
                }
            };
            sock.ev.on('connection.update', listener);
        });
    };

    await waitForConnection();

    // 3. Select Group
    if (!groupId) {
        console.log('Loading chats...');
        await new Promise(r => setTimeout(r, 2000));
        
        const chats = Object.values(store.chats).filter(c => c.id.endsWith('@g.us') || c.id.endsWith('@s.whatsapp.net'));
        chats.sort((a, b) => (b.t || 0) - (a.t || 0));

        console.log('\nAvailable Chats:');
        chats.slice(0, 20).forEach((c, i) => {
            console.log(`${i + 1}. ${store.getChatName(c.id)} (${c.id})`);
        });

        const answer = await ask('\nSelect chat number: ');
        const selectedChat = chats[parseInt(answer) - 1];
        if (!selectedChat) {
            console.error('Invalid selection');
            process.exit(1);
        }
        groupId = selectedChat.id;
        saveCache({ groupId });
        console.log(`Selected: ${store.getChatName(groupId)}`);
    } else {
        console.log(`Using cached group: ${store.getChatName(groupId)}`);
    }

    // 4. Start Server & Update Loop
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    async function updateTimeline() {
        // store.syncFromFile(); // Removed to prevent race conditions/overwrites. We rely on live events.
        console.log('Checking for new messages...');
        console.log('DEBUG: store messages count:', (store.messages[groupId] || []).length);
        const allMessages = store.messages[groupId] || [];
        
        // Filter processed - only get messages newer than last known timestamp
        const processedSet = new Set(processedMsgIds);
        let newMessages = allMessages.filter(m => {
            const msgTime = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp);
            // Only get messages newer than lastMessageTimestamp AND not already processed
            return msgTime > lastMessageTimestamp && !processedSet.has(m.key.id);
        });
        
        // Sort by time (newest first for latest messages)
        newMessages.sort((a, b) => {
            const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
            const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
            return tB - tA; // Reverse order for newest first
        });

        if (newMessages.length > 75) {
            console.log(`Too many new messages (${newMessages.length}). Processing latest 75 (most recent).`);
            // Process NEWEST first 
            newMessages = newMessages.slice(0, 75);
        }

        if (newMessages.length > 0) {
            console.log(`Found ${newMessages.length} new messages. Extracting events...`);
            const newEvents = await extractEvents(apiKey, newMessages);
            
            // Mark as processed
            newMessages.forEach(m => processedMsgIds.push(m.key.id));
            
            if (newEvents && Array.isArray(newEvents) && newEvents.length > 0) {
                console.log(`Extracted ${newEvents.length} events.`);
                // Update cache
                events = [...events, ...newEvents];
                // Sort events by timestamp
                events.sort((a, b) => a.timestamp - b.timestamp);
                
                const lastMsg = newMessages[newMessages.length - 1];
                lastMessageTimestamp = (typeof lastMsg.messageTimestamp === 'object' ? lastMsg.messageTimestamp.low : lastMsg.messageTimestamp);
                
                saveCache({ events, lastMessageTimestamp, processedMsgIds });
                console.log('Cache updated.');
            } else {
                console.log('No events extracted from new messages.');
                // Still update timestamp/ids
                const lastMsg = newMessages[newMessages.length - 1];
                lastMessageTimestamp = (typeof lastMsg.messageTimestamp === 'object' ? lastMsg.messageTimestamp.low : lastMsg.messageTimestamp);
                saveCache({ lastMessageTimestamp, processedMsgIds });
            }
        } else {
            console.log('No new messages.');
        }
    }

    // Run update immediately then schedule
    await updateTimeline();
    setInterval(updateTimeline, 60 * 1000); 
    setInterval(() => store.writeToFile(), 10000);

    app.get('/', (req, res) => {
        // Reload cache to be safe
        const current = loadCache();
        const gid = current.groupId;
        let chatName = store.getChatName(gid);
        
        console.log(`DEBUG: Root route. GroupID: ${gid}`);
        console.log(`DEBUG: ChatName from store: ${chatName}`);
        if (!chatName && gid) {
             const chat = store.chats[gid];
             const contact = store.contacts[gid];
             console.log(`DEBUG: Store lookup - Chat: ${JSON.stringify(chat)}, Contact: ${JSON.stringify(contact)}`);
        }
        
        if (!chatName && gid === '120363425029379306@g.us') {
            chatName = 'אלה קקי פיפי';
        }
        
        chatName = chatName || 'היומן של אלה';
        console.log(`Serving timeline with ${current.events?.length || 0} events. Chat: ${chatName}`);
        res.render('timeline', { events: current.events, chatName });
    });

    app.get('/reset', (req, res) => {
        saveCache({ events: [], lastMessageTimestamp: 0, processedMsgIds: [] });
        events = [];
        lastMessageTimestamp = 0;
        processedMsgIds = [];
        res.send('Reset cache. Triggering update...');
        updateTimeline();
    });

    app.listen(PORT, () => {
        const localIp = getLocalIp();
        console.log(`\nServer running at:`);
        console.log(`- Local:   http://localhost:${PORT}`);
        console.log(`- Network: http://${localIp}:${PORT}`);
        console.log('Press Ctrl+C to stop');
        console.log('Type "reset" to clear cache and resync.');
    });

    // Console Command Handler
    rl.on('line', (line) => {
        if (line.trim().toLowerCase() === 'reset') {
            console.log('\n[Command] Resetting cache and resyncing...');
            events = [];
            lastMessageTimestamp = 0;
            processedMsgIds = [];
            saveCache({ events: [], lastMessageTimestamp: 0, processedMsgIds: [] });
            updateTimeline();
        }
    });
}

main().catch(err => console.error(err));
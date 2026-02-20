import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { RafiAgent } from './rafi/agent.js';
import { NanieAgent } from './nanie/agent.mjs';
import { GoogleGenAI } from "@google/genai";

config();

console.log("--------------------------------------------------");
console.log("AGENT STARTING V4.0 - TIMESTAMP: " + new Date().toISOString());
console.log("--------------------------------------------------");

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENT_ID = 'alex-bot';
const ROOT_DIR = process.cwd();

console.log(`[Alex] Supabase URL: ${SUPABASE_URL}`);
console.log(`[Alex] Key Length: ${SUPABASE_SERVICE_KEY ? SUPABASE_SERVICE_KEY.length : 0}`);

if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in .env.");
    process.exit(1);
}

// Global Error Handlers to prevent silent exits
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

process.on('exit', (code) => {
    console.log(`[Agent] Process exiting with code: ${code}`);
});

// --- HELPER: Spawn Gemini CLI (Streaming) ---
async function spawnGemini(prompt, cwd = ROOT_DIR, onEvent) {
    console.log(`[Gemini] Spawning in ${cwd} for: "${prompt.substring(0, 50)}"...`);
    
    return new Promise((resolve, reject) => {
        const child = spawn('gemini', ['-p', prompt, '--yolo', '--output-format', 'stream-json'], {
            cwd: cwd,
            shell: false
        });

        let stderr = '';
        let buffer = '';

        const timeout = setTimeout(() => {
            child.kill();
            reject(new Error('Gemini CLI timed out'));
        }, 120000);

        child.stdout.on('data', async (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop(); 

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const event = JSON.parse(line);
                    // Handle async callback safely
                    await onEvent(event).catch(err => console.error("Error in onEvent handler:", err));
                } catch (e) { 
                    // ignore non-json lines
                }
            }
        });

        child.stderr.on('data', (data) => stderr += data);

        child.on('close', (code) => {
            clearTimeout(timeout);
            if (code !== 0) {
                console.error(`[Gemini] Error (code ${code}): ${stderr}`);
                reject(new Error(`Gemini CLI failed: ${stderr}`));
            } else {
                resolve();
            }
        });
    });
}

// --- HELPER: Gemini SDK (Fast, Text-Only) ---
async function runGeminiSDK(prompt, onEvent, tools = []) {
    console.log(`[Gemini SDK] Generating for: "${prompt.substring(0, 50)}"...`);
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const config = tools.length > 0 ? { tools: [{ function_declarations: tools }] } : {};

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const result = await genAI.models.generateContentStream({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config
            });
            let totalText = "";
            
            for await (const chunk of result) {
                // Handle Tool Calls
                const toolCalls = chunk.candidates?.[0]?.content?.parts?.filter(p => p.functionCall);
                if (toolCalls && toolCalls.length > 0) {
                    for (const tc of toolCalls) {
                        await onEvent({
                            type: 'tool_use',
                            tool_id: tc.functionCall.id || `call_${Date.now()}`,
                            tool_name: tc.functionCall.name,
                            parameters: tc.functionCall.args
                        });
                    }
                }

                const chunkText = chunk.text;
                if (chunkText) {
                    totalText += chunkText;
                    await onEvent({
                        type: 'message',
                        role: 'assistant',
                        content: chunkText 
                    });
                }
            }
            
            // Final stats
            await onEvent({ type: 'result', stats: { total_tokens: Math.ceil(totalText.length / 4) } });
            return;
        } catch (e) {
            const isRetryable = e.status === 429 || 
                                (e.message && e.message.includes('429')) ||
                                (e.message && e.message.includes('Failed to parse stream')) ||
                                (e.message && e.message.includes('fetch failed'));
            
            if (isRetryable) {
                attempt++;
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                console.warn(`[Gemini SDK] Transient error (${e.message}). Retrying in ${Math.round(delay)}ms (Attempt ${attempt}/${maxRetries})...`);
                if (attempt >= maxRetries) throw e;
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error("[Gemini SDK] Error:", e);
                throw e;
            }
        }
    }
}

// --- HELPER: App Context ---
async function getAppDirectory(roomId) {
    if (!roomId || roomId === 'home' || roomId === 'root') {
        return ROOT_DIR;
    }

    try {
        const data = await fs.readFile(path.join(ROOT_DIR, 'apps.json'), 'utf-8');
        const apps = JSON.parse(data);
        const app = apps.find(a => a.id === roomId);
        if (app) return path.dirname(path.join(ROOT_DIR, app.path));
    } catch (e) { 
        console.error("Error reading apps.json:", e);
    }
    
    return ROOT_DIR;
}

// --- AGENT LOOP ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } }
});

const pollingSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

const NANIE_TOOLS = [
    {
        name: "get_recent_events",
        description: "Fetch the most recent baby tracking events (feeding, sleeping, diapers).",
        parameters: {
            type: "object",
            properties: {
                limit: { type: "number", description: "Number of events to fetch (default 20)" },
                type: { type: "string", description: "Filter by event type (feeding, sleeping, diaper, bath, waking_up, other)" }
            }
        }
    }
];

const RAFI_TOOLS = [
    {
        name: "get_account_balance",
        description: "Fetch the current balance for all or a specific bank account.",
        parameters: {
            type: "object",
            properties: {
                account_id: { type: "string", description: "Optional specific account number to fetch" }
            }
        }
    },
    {
        name: "search_transactions",
        description: "Search for specific transactions by description or date range.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Search term for transaction description" },
                days: { type: "number", description: "Number of past days to search (default 30)" }
            }
        }
    }
];

async function sendReply(roomId, conversationId, content) {
    // Phase 16: Automatically flag ephemeral types
    let payload = content;
    
    // If content is already a string, try to parse it to check type, then re-stringify
    if (typeof content === 'string') {
        try {
            if (content.trim().startsWith('{')) {
                const parsed = JSON.parse(content);
                if (typeof parsed === 'object') payload = parsed;
            }
        } catch (e) {}
    }

    if (typeof payload === 'object' && payload !== null) {
        if (['DATA', 'SYSTEM', 'STATUS', 'ERROR'].includes(payload.type)) {
            payload.ephemeral = true;
        }
        // Re-stringify for DB
        payload = JSON.stringify(payload);
    } else {
        // Just text
        payload = String(content);
    }

    console.log(`[Agent] Sending reply to ${roomId}/${conversationId}: ${payload.substring(0, 100)}...`);
    
    // Create a promise that rejects after 10 seconds
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase insert timed out')), 10000)
    );

    try {
        const { data, error } = await Promise.race([
            supabase.from('messages').insert({
                room_id: roomId,
                conversation_id: conversationId,
                content: payload,
                sender_id: AGENT_ID,
                is_bot: true
            }).select(),
            timeout
        ]);

        if (error) {
            console.error("Send Error:", error);
        } else {
            console.log(`[Agent] Reply sent successfully. ID: ${data?.[0]?.id}`);
        }
        return data?.[0]?.id;
    } catch (e) {
        console.error("SendReply Exception:", e);
        return null;
    }
}

async function updateReply(messageId, content) {
    const { error } = await supabase.from('messages').update({
        content: content
    }).eq('id', messageId);
    
    if (error) {
        console.error("Update Error:", error);
    }
}

async function updateConversationTitle(conversationId, history) {
    try {
        console.log(`[Agent] Generating title for conversation ${conversationId}...`);
        
        const historyText = history.map(m => `${m.is_bot ? 'Bot' : 'User'}: ${m.content}`).join('\n');
        const prompt = `Summarize the following chat conversation into a concise title (3-5 words max). Respond ONLY with the title text, no quotes or punctuation.\n\nConversation:\n${historyText}`;

        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const result = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
        });
        const title = result.text.trim();

        if (title) {
            console.log(`[Agent] New title: "${title}"`);
            await supabase.from('conversations').update({ title }).eq('id', conversationId);
        }
    } catch (e) {
        console.error("[Agent] Error generating title:", e);
    }
}

async function deleteReply(messageId) {
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) {
        console.error("Delete Error:", error);
    }
}

function buildContent(state) {
    let output = "";
    
    for (const item of state.timeline) {
        if (item.type === 'text') {
            output += item.content;
        } else if (item.type === 'tool') {
            const args = JSON.stringify(item.args, null, 2);
            output += `\n<tool_call name="${item.name}" status="${item.status}">\n${args}\n</tool_call>\n`;
        }
    }
    
    return {
        type: 'text',
        content: output,
        stats: state.stats
    };
}

// Initialize Rafi Agent
console.log('[Alex] Initializing Rafi Agent...');
const rafiAgent = new RafiAgent({
    send: sendReply,
    update: updateReply,
    delete: deleteReply
});
// const rafiAgent = { handleMessage: async () => {} };

// Initialize Nanie Agent
console.log('[Alex] Initializing Nanie Agent...');
const nanieAgent = new NanieAgent({
    send: sendReply,
    update: updateReply,
    delete: deleteReply
});
console.log('[Alex] Nanie Agent initialized.');

// const nanieAgent = { handleMessage: async () => {} }; // Mock for now

const processedMessageIds = new Set();
let isInitialSubscription = true;
let pollCounter = 0;

async function fetchUnreadMessages() {
    pollCounter++;
    const isPeriodicLog = (pollCounter % 6 === 0); // Every 60s (10s * 6)
    
    if (isPeriodicLog) {
        console.log("[Alex] Periodic check for unread messages...");
    }

    try {
        // Fetch last 50 messages to cover active rooms
        const { data: messages, error } = await pollingSupabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("[Alex] Error fetching history:", error);
            return;
        }

        if (messages.length > 0 && isPeriodicLog) {
            console.log(`[Alex] Fetched ${messages.length} messages.`);
        }
        
        const latestMessagesByConversation = new Map();
        
        // Find latest message for each conversation
        for (const msg of messages) {
            if (!latestMessagesByConversation.has(msg.conversation_id)) {
                latestMessagesByConversation.set(msg.conversation_id, msg);
            }
        }

        const pendingConversations = [];
        for (const [convId, msg] of latestMessagesByConversation) {
             if (!msg.is_bot && msg.sender_id !== AGENT_ID && !processedMessageIds.has(msg.id)) {
                 pendingConversations.push(convId);
             }
        }

        if (pendingConversations.length > 0) {
            console.log(`[Alex] Pending messages in ${pendingConversations.length} conversations: ${pendingConversations.join(', ')}`);
        } else if (isPeriodicLog && latestMessagesByConversation.size > 0) {
            // Only log unique conversations periodically if nothing pending
            // console.log(`[Alex] Unique conversations: ${latestMessagesByConversation.size}`);
        }

        for (const [convId, msg] of latestMessagesByConversation) {
            // If the last message in the conversation is NOT from a bot, it's pending
            if (!msg.is_bot && msg.sender_id !== AGENT_ID) {
                if (!processedMessageIds.has(msg.id)) {
                    console.log(`[Alex] Processing NEW message ${msg.id} in ${convId}: ${msg.content.substring(0, 30)}...`);
                    processedMessageIds.add(msg.id);
                    handleMessage(msg); 
                }
            }
        }
    } catch (e) {
        console.error("[Alex] Exception checking unread:", e);
    }
}

async function handleMessage(message) {
    const roomId = message.room_id || 'home';
    console.log(`[Agent] Handling message ${message.id} in '${roomId}': ${message.content.substring(0, 100)}`);
    
    // Validate Conversation ID (Must be UUID)
    let conversationId = message.conversation_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!conversationId || !uuidRegex.test(conversationId)) {
        if (message.sender_id && uuidRegex.test(message.sender_id)) {
            conversationId = message.sender_id; 
        } else {
             conversationId = null; 
        }
    }

    // --- CHECK FOR RAFI HANDLER ---
    // If it's a JSON message with an action, or explicitly in 'rafi' room
    let isRafiCommand = false;
    try {
        const json = JSON.parse(message.content);
        if (json.action && ['INIT_SESSION', 'LOGIN', 'FETCH', 'SUBMIT_OTP', 'REQUEST_AUTH_URL'].includes(json.action)) {
            isRafiCommand = true;
        }
        if (json.action === 'DELETE_CONVERSATION' && roomId === 'rafi') {
            isRafiCommand = true;
        }
    } catch (e) {}

    if (isRafiCommand) {
        // Intercept for Rafi
        // We pass a context-aware reply control object
        const replyControl = {
            send: (msg) => sendReply(roomId, conversationId, msg),
            update: (msgId, content) => updateReply(msgId, typeof content === 'string' ? content : JSON.stringify(content)),
            delete: (msgId) => deleteReply(msgId)
        };

        await rafiAgent.handleMessage(message, replyControl);

        // Phase 16: Delete the command message after processing (unless debug is on)
        try {
            const json = JSON.parse(message.content);
            if (json.debug !== true) {
                console.log(`[Agent] Deleting ephemeral Rafi command: ${message.id}`);
                await deleteReply(message.id);
            }
        } catch (e) {}
        return;
    }

    // --- CHECK FOR NANIE HANDLER ---
    let isNanieCommand = false;
    try {
        const json = JSON.parse(message.content);
        if (json.action && ['GET_STATUS', 'ADD_EVENT', 'LIST_GROUPS', 'SELECT_GROUP', 'RESYNC_HISTORY', 'RETRY_SYNC'].includes(json.action)) {
            isNanieCommand = true;
        }
        if (json.action === 'DELETE_CONVERSATION' && roomId === 'nanie') {
            isNanieCommand = true;
        }
    } catch (e) {}

    if (isNanieCommand) {
        const replyControl = {
            send: (msg) => sendReply(roomId, conversationId, msg),
            update: (msgId, content) => updateReply(msgId, typeof content === 'string' ? content : JSON.stringify(content)),
            delete: (msgId) => deleteReply(msgId)
        };
        await nanieAgent.handleMessage(message, replyControl);

        // Phase 16: Delete the command message after processing (unless debug is on)
        try {
            const json = JSON.parse(message.content);
            if (json.debug !== true) {
                console.log(`[Agent] Deleting ephemeral Nanie command: ${message.id}`);
                await deleteReply(message.id);
            }
        } catch (e) {}
        return;
    }

    // --- STANDARD GEMINI AGENT ---
    const targetDir = await getAppDirectory(roomId);

    // FETCH CONTEXT
    let fullPrompt = message.content;
    try {
        const { data: history } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .lt('created_at', message.created_at) // Exclude current message
            .order('created_at', { ascending: false })
            .limit(10);
            
        let context = "";
        if (history && history.length > 0) {
            context = "Here is the recent chat history (most recent last):\n" + 
                history.reverse().map(m => {
                    let content = m.content;
                    
                    try {
                        // Check if content is JSON
                        if (content.trim().startsWith('{')) {
                            const json = JSON.parse(content);
                            
                            // 1. Hide User Control Messages
                            if (!m.is_bot && (json.action || json.ephemeral)) {
                                return null;
                            }

                            // 2. Hide Bot Protocol Messages
                            if (m.is_bot) {
                                if (json.ephemeral) return null;
                                if (json.type === 'text' && json.content) {
                                    content = json.content;
                                } else if (json.type === 'thinking') {
                                    return null; // Skip thinking messages
                                } else if (json.type && json.type !== 'error') {
                                    return null; // Skip DATA, STATUS, etc.
                                }
                            }
                        }
                    } catch (e) {
                        // Not JSON, treat as text
                    }

                    return `${m.is_bot ? 'Assistant' : 'User'}: ${content}`;
                }).filter(Boolean).join("\n") + "\n---\n";
        }
        
        if (roomId === 'rafi') {
            const snapshot = await rafiAgent.getContextSnapshot(conversationId);
            
            let specializedPrompt = `
ROLE: You are Rafi, an expert financial advisor and data analyst.
CONTEXT: The user is asking about their bank data.

CURRENT_STATE:
${JSON.stringify(snapshot, null, 2)}

INSTRUCTIONS:
1. Use the CURRENT_STATE above for high-level info (which accounts are connected, last sync time).
2. If you need details like balances or specific transactions, use the available tools.
3. Be concise and helpful.
4. ALWAYS respond in the SAME LANGUAGE as the user's current request.
`;
            
            fullPrompt = specializedPrompt + "\n" + context + "Current Request: " + message.content;
        } else if (roomId === 'nanie') {
            const snapshot = await nanieAgent.getContextSnapshot(conversationId);
            const events = await nanieAgent.getContext(conversationId);
            const recentMsgs = await nanieAgent.getRecentMessages(conversationId, 50);

            console.log(`[Agent/Nanie] Mappings: ${nanieAgent.mappingManager.mappings.size}. Context for ${conversationId}: ${events?.length || 0} events, ${recentMsgs?.length || 0} recent messages.`);

            let specializedPrompt = `
ROLE: You are Ella's Nanny, an expert baby tracker assistant.
CONTEXT: The user is asking about Ella's schedule (eating, sleeping, diapers).

CURRENT_STATE:
${JSON.stringify(snapshot, null, 2)}
`;

            if (recentMsgs && recentMsgs.length > 0) {
                 const chatLog = recentMsgs.map(m => 
                     `[${new Date(m.timestamp).toLocaleString()}] ${m.sender}: ${m.text}`
                 ).join('\n');
                 
                 specializedPrompt += `
RECENT_WHATSAPP_LOG (Raw Chat):
${chatLog}
`;
            }

            if (events && events.length > 0) {
                const lastEvents = events.slice(-50).map(e => 
                   `[${new Date(e.timestamp).toLocaleString()}] ${e.type.toUpperCase()}: ${e.details} (Hunger: ${e.hungerLevel})`
                ).join('\n');
                
                specializedPrompt += `
EXTRACTED_EVENTS (Structured):
${lastEvents}
`;
            }

            specializedPrompt += `
INSTRUCTIONS:
1. Use any available data (EXTRACTED_EVENTS or RECENT_WHATSAPP_LOG) to answer. 
2. EXTRACTED_EVENTS are more reliable for timing. RECENT_WHATSAPP_LOG gives more context and details not yet processed.
3. If no data is available for a specific time range, state that you don't see info for that time in your logs.
4. If asked about "next feed", estimate based on hunger level and last feed time.
5. Be concise and caring.
6. ALWAYS respond in the SAME LANGUAGE as the user's current request.
`;

            if (!events?.length && !recentMsgs?.length) {
                specializedPrompt += "\nNOTE: You currently have NO access to recent data for this conversation. Politely explain that the WhatsApp group might not be linked or there is no recent activity.\n";
            }

            fullPrompt = specializedPrompt + "\n" + context + "Current Request: " + message.content;
        } else {
            const langInstruction = "INSTRUCTION: Always respond in the same language as the user's current request.\n\n";
            fullPrompt = langInstruction + context + "Current Request: " + message.content;
        }

    } catch (e) { 
        console.error("Error fetching context:", e); 
    }

    const state = {
        timeline: [], // { type: 'text', content: '' } | { type: 'tool', ... }
        stats: null
    };

    const messageId = await sendReply(roomId, conversationId, JSON.stringify({ type: 'thinking' }));
    if (!messageId) {
        console.error("Failed to create initial message. Aborting.");
        return;
    }

    let lastUpdate = Date.now();
    const updateDB = async (force = false) => {
        const now = Date.now();
        if (force || (now - lastUpdate > 800)) { 
            await updateReply(messageId, JSON.stringify(buildContent(state)));
            lastUpdate = now;
        }
    };

    const eventHandler = async (event) => {
        let needsUpdate = false;

        if (event.type === 'tool_use') {
            const args = event.parameters || event.tool_args || event.args || {};
            const toolCallId = event.tool_id;
            
            state.timeline.push({
                type: 'tool',
                id: toolCallId,
                name: event.tool_name,
                args: args,
                status: 'running'
            });
            
            // Inject file update for preview if applicable (legacy)
            if (event.tool_name === 'write_file' && args.file_path && args.content) {
                state.timeline.push({
                    type: 'text',
                    content: `\n<file_update path="${args.file_path}">${args.content}</file_update>\n`
                });
            }

            needsUpdate = true;
            await updateDB(true);

            // Execute Tool
            let result = "Tool not found";
            try {
                if (roomId === 'nanie') {
                    if (event.tool_name === 'get_recent_events') {
                        const limit = args.limit || 20;
                        const type = args.type;
                        const events = await nanieAgent.getContext(conversationId);
                        const filtered = type ? events.filter(e => e.type === type) : events;
                        result = JSON.stringify(filtered.slice(-limit));
                    }
                } else if (roomId === 'rafi') {
                    if (event.tool_name === 'get_account_balance') {
                        const data = await rafiAgent.getAccountData(conversationId);
                        if (!data) result = "No banking data available. User must sync first.";
                        else {
                            if (args.account_id) {
                                const acc = data.accounts.find(a => a.accountNumber === args.account_id);
                                result = acc ? JSON.stringify({ balance: acc.balance, currency: acc.currency }) : "Account not found";
                            } else {
                                result = JSON.stringify(data.accounts.map(a => ({ name: a.accountName, balance: a.balance, currency: a.currency })));
                            }
                        }
                    } else if (event.tool_name === 'search_transactions') {
                        const data = await rafiAgent.getAccountData(conversationId);
                        if (!data) result = "No banking data available.";
                        else {
                            const query = (args.query || "").toLowerCase();
                            const days = args.days || 30;
                            const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
                            
                            const matches = [];
                            data.accounts.forEach(acc => {
                                (acc.txns || []).forEach(txn => {
                                    if (new Date(txn.date).getTime() > cutoff) {
                                        if (!query || (txn.description || "").toLowerCase().includes(query)) {
                                            matches.push(txn);
                                        }
                                    }
                                });
                            });
                            result = JSON.stringify(matches.slice(0, 50));
                        }
                    }
                }
            } catch (e) {
                result = `Error: ${e.message}`;
            }

            const tool = state.timeline.find(t => t.type === 'tool' && t.id === toolCallId);
            if (tool) tool.status = 'success';
            
            // Important: We need to feed this back to Gemini.
            // For now, we'll append it to the prompt and re-run? 
            // Better: runGeminiSDK should handle the multi-turn internally if we want it clean,
            // or we return the tool result and loop here.
            
            // Let's store tool results to pass back in the next iteration
            if (!state.toolResults) state.toolResults = [];
            state.toolResults.push({
                callId: toolCallId,
                name: event.tool_name,
                result: result
            });

            needsUpdate = true;
        }
        
        if (event.type === 'tool_result') {
            const tool = state.timeline.find(t => t.type === 'tool' && t.id === event.tool_id);
            if (tool) tool.status = event.status || 'success';
            needsUpdate = true;
        }
        
        if (event.type === 'message' && event.role === 'assistant') {
            if (event.content) {
                const last = state.timeline[state.timeline.length - 1];
                if (last && last.type === 'text') {
                    last.content += event.content;
                } else {
                    state.timeline.push({ type: 'text', content: event.content });
                }
                // Only update periodically for text to avoid thrashing
            }
        }

        if (event.type === 'result') {
            state.stats = event.stats;
            needsUpdate = true;
        }

        await updateDB(needsUpdate); 
    };

    try {
        const useSDK = (roomId !== 'home' && roomId !== 'root');
        
        if (useSDK) {
            const tools = roomId === 'nanie' ? NANIE_TOOLS : (roomId === 'rafi' ? RAFI_TOOLS : []);
            let currentPrompt = fullPrompt;
            let iterations = 0;
            const maxIterations = 5;

            while (iterations < maxIterations) {
                state.toolResults = []; // Clear for this turn
                await runGeminiSDK(currentPrompt, eventHandler, tools);
                
                if (state.toolResults && state.toolResults.length > 0) {
                    // Gemini called tools, we executed them and populated state.toolResults
                    // Now we must feed them back.
                    // The SDK generateContentStream expects the whole conversation history including function responses.
                    // For simplicity, we'll append the tool results to the prompt for the next turn.
                    
                    let toolResponsePart = "\n\nTool Results:\n";
                    for (const tr of state.toolResults) {
                        toolResponsePart += `Tool: ${tr.name}\nResult: ${tr.result}\n\n`;
                    }
                    
                    currentPrompt += toolResponsePart;
                    iterations++;
                    console.log(`[Agent] Tool calls executed. Starting iteration ${iterations}...`);
                } else {
                    // No more tool calls, we are done
                    break;
                }
            }
        } else {
            await spawnGemini(fullPrompt, targetDir, eventHandler);
        }

        await updateDB(true);

        // --- AUTO-TITLING ---
        if (conversationId) {
            const { data: conv } = await supabase.from('conversations').select('title').eq('id', conversationId).single();
            if (conv && conv.title === 'New Chat') {
                const { data: history } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', conversationId)
                    .order('created_at', { ascending: true });
                
                if (history && history.length >= 3) {
                    // Background task (don't await to avoid blocking)
                    updateConversationTitle(conversationId, history).catch(console.error);
                }
            }
        }

    } catch (e) {
        console.error("[Alex] Error:", e);
        // Append error to timeline or just text
        state.timeline.push({ type: 'text', content: `\n\n❌ **Error:** ${e.message}` });
        await updateDB(true);
    }
}

// --- CLEANUP TASK ---
async function cleanupStuckMessages() {
    console.log("[Alex] Running cleanup task for stuck ephemeral messages...");
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        
        // 1. Find explicit ephemeral messages
        const { data: ephemeralMsgs, error: err1 } = await supabase
            .from('messages')
            .select('id')
            .lt('created_at', fiveMinutesAgo)
            .ilike('content', '%"ephemeral":true%')
            .limit(100);

        if (err1) console.error("[Alex] Error fetching ephemeral candidates:", err1.message);

        // 2. Find implicit protocol messages (SYSTEM, STATUS, ERROR)
        const { data: protocolMsgs, error: err2 } = await supabase
            .from('messages')
            .select('id')
            .lt('created_at', fiveMinutesAgo)
            .or('content.ilike.%"type":"SYSTEM"%,content.ilike.%"type":"STATUS"%,content.ilike.%"type":"ERROR"%')
            .limit(100);

        if (err2) console.error("[Alex] Error fetching protocol candidates:", err2.message);

        const idsToDelete = [...new Set([
            ...(ephemeralMsgs || []).map(m => m.id),
            ...(protocolMsgs || []).map(m => m.id)
        ])];

        if (idsToDelete.length > 0) {
            console.log(`[Alex] Deleting ${idsToDelete.length} stuck messages: ${idsToDelete.join(', ')}`);
            await supabase.from('messages').delete().in('id', idsToDelete);
        }
    } catch (e) {
        console.error("[Alex] Cleanup failed:", e);
    }
}

// --- MAIN ---
console.log("[Alex] Agent starting (Global Listener + Polling)...");

// Polling Fallback (Every 10 seconds)
setInterval(() => {
    fetchUnreadMessages();
}, 10000);

// Cleanup Task (Every 5 minutes)
setInterval(() => {
    cleanupStuckMessages();
}, 5 * 60 * 1000);

// Initial Cleanup
cleanupStuckMessages();

supabase
    .channel('public:messages')
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public',
        table: 'messages'
    }, (payload) => {
        const msg = payload.new;
        if (!processedMessageIds.has(msg.id)) {
            processedMessageIds.add(msg.id);
            if (!msg.is_bot && msg.sender_id !== AGENT_ID) {
                handleMessage(msg);
            }
        }
    })
    .subscribe((status, err) => {
        // Safe logging of status
        console.log(`[Alex] Listening on ALL rooms... Status: ${status}`);
        if (err) console.error("[Alex] Subscription Error:", err);

        if (status === 'SUBSCRIBED' && isInitialSubscription) {
            isInitialSubscription = false;
            fetchUnreadMessages();
        }
    });
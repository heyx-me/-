import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { RafiAgent } from './rafi/agent.js';

config();

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENT_ID = 'alex-bot';
const ROOT_DIR = process.cwd();

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

async function sendReply(roomId, conversationId, content) {
    // If content is object, stringify it
    const msgContent = typeof content === 'string' ? content : JSON.stringify(content);
    console.log(`[Agent] Sending reply to ${roomId}/${conversationId}: ${msgContent.substring(0, 100)}...`);
    
    // Create a promise that rejects after 10 seconds
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase insert timed out')), 10000)
    );

    try {
        const { data, error } = await Promise.race([
            supabase.from('messages').insert({
                room_id: roomId,
                conversation_id: conversationId,
                content: msgContent,
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
    
    // Stats Footer
    if (state.stats) {
        const total = state.stats.total_tokens || state.stats.tokens?.total || 0;
        output += `\n\n_📊 Tokens: ${total}_`;
    } else if (state.timeline.some(t => t.type === 'tool' && t.status === 'running')) {
        output += `\n\n_Thinking..._`;
    }

    return output;
}

// Initialize Rafi Agent
const rafiAgent = new RafiAgent({
    send: sendReply,
    update: updateReply,
    delete: deleteReply
});

const processedMessageIds = new Set();
let isInitialSubscription = true;

async function fetchUnreadMessages() {
    console.log("[Alex] Checking for unread messages...");
    try {
        // Fetch last 50 messages to cover active rooms
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error("[Alex] Error fetching history:", error);
            return;
        }

        const latestMessagesByRoom = new Map();
        
        // Find latest message for each room
        for (const msg of messages) {
            if (!latestMessagesByRoom.has(msg.room_id)) {
                latestMessagesByRoom.set(msg.room_id, msg);
            }
        }

        for (const [roomId, msg] of latestMessagesByRoom) {
            // If the last message in the room is NOT from a bot, it's pending
            if (!msg.is_bot && msg.sender_id !== AGENT_ID) {
                console.log(`[Alex] Found unread message in '${roomId}': ${msg.content.substring(0, 30)}...`);
                
                if (!processedMessageIds.has(msg.id)) {
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
    console.log(`[Agent] Received in '${roomId}': ${message.content}`);
    
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
            .eq('room_id', roomId)
            .lt('created_at', message.created_at) // Exclude current message
            .order('created_at', { ascending: false })
            .limit(10);
            
        let context = "";
        if (history && history.length > 0) {
            context = "Here is the recent chat history (most recent last):\n" + 
                history.reverse().map(m => 
                    `${m.is_bot ? 'Assistant' : 'User'}: ${m.content}`
                ).join("\n") + "\n---\n";
        }
        
        if (roomId === 'rafi') {
            // Fetch latest financial data from messages
            let financialData = null;
            try {
                // We fetch a bit more history to find the last data sync
                const { data: dataMsgs } = await supabase
                    .from('messages')
                    .select('content')
                    .eq('room_id', roomId)
                    .eq('is_bot', true) // Data comes from bot
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (dataMsgs) {
                    for (const msg of dataMsgs) {
                        try {
                            const json = JSON.parse(msg.content);
                            if ((json.type === 'DATA' || json.type === 'LOGIN_SUCCESS') && json.data) {
                                financialData = json.data;
                                break; // Found latest
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {
                console.error("Error fetching financial data:", e);
            }

            let specializedPrompt = `
ROLE: You are Rafi, an expert financial advisor and data analyst.
CONTEXT: The user is asking about their bank data.
`;

            if (financialData) {
                // Truncate if absurdly large, but usually fine for personal banking
                const dataStr = JSON.stringify(financialData);
                specializedPrompt += `
USER_DATA: ${dataStr}
INSTRUCTIONS:
1. The user's financial data is provided above in USER_DATA.
2. Use this data to answer questions about savings, spending, or balances.
3. Be concise and helpful.
`;
            } else {
                specializedPrompt += `
INSTRUCTIONS:
1. You do not have access to the user's financial data yet.
2. Ask the user to log in or fetch their data using the UI buttons.
`;
            }
            
            fullPrompt = specializedPrompt + "\n" + context + "Current Request: " + message.content;
        } else {
            fullPrompt = context + "Current Request: " + message.content;
        }

    } catch (e) { 
        console.error("Error fetching context:", e); 
    }

    const state = {
        timeline: [], // { type: 'text', content: '' } | { type: 'tool', ... }
        stats: null
    };

    const messageId = await sendReply(roomId, conversationId, "⏳ _Thinking..._");
    if (!messageId) {
        console.error("Failed to create initial message. Aborting.");
        return;
    }

    let lastUpdate = Date.now();
    const updateDB = async (force = false) => {
        const now = Date.now();
        if (force || (now - lastUpdate > 800)) { 
            await updateReply(messageId, buildContent(state));
            lastUpdate = now;
        }
    };

    try {
        await spawnGemini(fullPrompt, targetDir, async (event) => {
            let needsUpdate = false;

            if (event.type === 'tool_use') {
                const args = event.parameters || event.tool_args || event.args || {};
                state.timeline.push({ 
                    type: 'tool', 
                    id: event.tool_id, 
                    name: event.tool_name, 
                    args: args, 
                    status: 'running' 
                });
                
                // Inject file update for preview if applicable
                if (event.tool_name === 'write_file' && args.file_path && args.content) {
                    state.timeline.push({
                        type: 'text',
                        content: `\n<file_update path="${args.file_path}">${args.content}</file_update>\n`
                    });
                }

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
        });

        await updateDB(true);

    } catch (e) {
        console.error("[Alex] Error:", e);
        // Append error to timeline or just text
        state.timeline.push({ type: 'text', content: `\n\n❌ **Error:** ${e.message}` });
        await updateDB(true);
    }
}

// --- MAIN ---
console.log("[Alex] Agent starting (Global Listener)...");

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

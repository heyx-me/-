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
const rafiAgent = new RafiAgent(sendReply);

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

    if (roomId === 'rafi' || isRafiCommand) {
        // Intercept for Rafi
        // We pass a context-aware reply callback
        await rafiAgent.handleMessage(message, async (msg) => {
             await sendReply(roomId, conversationId, msg);
        });
        return;
    }

    // --- STANDARD GEMINI AGENT ---
    const targetDir = await getAppDirectory(roomId);

    const state = {
        timeline: [], // { type: 'text', content: '' } | { type: 'tool', ... }
        stats: null
    };

    const messageId = await sendReply(roomId, conversationId, "⏳ _Reading codebase..._");
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
        await spawnGemini(message.content, targetDir, async (event) => {
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
        if (!msg.is_bot && msg.sender_id !== AGENT_ID) {
            handleMessage(msg);
        }
    })
    .subscribe((status, err) => {
        // Safe logging of status
        console.log(`[Alex] Listening on ALL rooms... Status: ${status}`);
        if (err) console.error("[Alex] Subscription Error:", err);
    });

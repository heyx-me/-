import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

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
    const { data, error } = await supabase.from('messages').insert({
        room_id: roomId,
        conversation_id: conversationId,
        content: content,
        sender_id: AGENT_ID,
        is_bot: true
    }).select(); 

    if (error) console.error("Send Error:", error);
    return data?.[0]?.id;
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
    let output = state.text;
    
    // Tools Section
    if (state.tools.length > 0) {
        output += "\n\n**Tool Execution:**\n";
        state.tools.forEach(t => {
            const icon = t.status === 'success' ? '✅' : (t.status === 'running' ? '⏳' : '❌');
            output += `- ${icon} 
`;
        });
    }
    
    // Stats Footer
    if (state.stats) {
        const total = state.stats.total_tokens || state.stats.tokens?.total || 0;
        output += `\n\n_📊 Tokens: ${total}_`;
    } else if (state.tools.some(t => t.status === 'running')) {
        output += `\n\n_Thinking..._`;
    }

    return output;
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

    const targetDir = await getAppDirectory(roomId);

    const state = {
        text: "",
        tools: [], 
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
                state.tools.push({ id: event.tool_id, name: event.tool_name, status: 'running' });
                needsUpdate = true;
            }
            
            if (event.type === 'tool_result') {
                const tool = state.tools.find(t => t.id === event.tool_id);
                if (tool) tool.status = event.status;
                needsUpdate = true;
            }
            
            if (event.type === 'message' && event.role === 'assistant') {
                if (event.content) {
                    state.text += event.content;
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
        state.text += `\n\n❌ **Error:** ${e.message}`;
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

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { RafiAgent } from './rafi/agent.js';
import { NanieAgent } from './nanie/agent.mjs';
import { GeminiBridge } from './lib/gemini-bridge.js';

config({ quiet: true });

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AGENT_ID = 'alex-bot';
const ROOT_DIR = process.cwd();

if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in .env.");
    process.exit(1);
}

// Global Error Handlers
process.on('uncaughtException', (err) => console.error('UNCAUGHT EXCEPTION:', err));
process.on('unhandledRejection', (reason) => console.error('UNHANDLED REJECTION:', reason));
process.on('exit', (code) => console.log(`[Agent] Process exiting with code: ${code}`));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } }
});

const pollingSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

// --- HELPERS ---

async function runGemini(conversationId, prompt, onEvent) {
    console.log(`[Gemini Bridge] Querying for ${conversationId} (Len: ${prompt.length})...`);
    const bridge = new GeminiBridge(conversationId);
    if (onEvent) bridge.on('event', onEvent);
    
    bridge.on('error', (err) => {
        console.error(`[Gemini Bridge] Error for ${conversationId}:`, err);
    });

    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Bridge Request Timeout')), 900000)
    );

    return Promise.race([bridge.query(prompt), timeout]).catch(err => {
        console.error(`[Gemini Bridge] Query failed for ${conversationId}:`, err);
        throw err;
    });
}

async function getChatContext(conversationId, limit = 10, excludeMessageId = null) {
    const { data: history, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit + 1);

    if (error || !history) return "";

    return history
        .filter(m => m.id !== excludeMessageId)
        .reverse()
        .map(m => {
            let content = m.content;
            try {
                if (content.trim().startsWith('{')) {
                    const json = JSON.parse(content);
                    if (!m.is_bot && json.action && json.type !== 'INPUT_RESPONSE') return null;
                    if (m.is_bot) {
                        if (json.ephemeral || json.type === 'thinking') return null;
                        if (json.type === 'text') content = json.content;
                        else if (json.type !== 'error') return null;
                    }
                }
            } catch (e) {}
            return `${m.is_bot ? 'Assistant' : 'User'}: ${content}`;
        })
        .filter(Boolean)
        .join("\n");
}

async function getAppDirectory(roomId) {
    if (!roomId || roomId === 'home' || roomId === 'root') return ROOT_DIR;
    try {
        const data = await fs.readFile(path.join(ROOT_DIR, 'apps.json'), 'utf-8');
        const apps = JSON.parse(data);
        const app = apps.find(a => a.id === roomId);
        if (app) return path.dirname(path.join(ROOT_DIR, app.path));
    } catch (e) {}
    return ROOT_DIR;
}

function buildContent(state) {
    let output = "";
    let hasContent = false;
    for (const item of state.timeline) {
        if (item.type === 'text') {
            output += item.content;
            if (item.content.trim()) hasContent = true;
        } else if (item.type === 'tool') {
            const args = JSON.stringify(item.args, null, 2);
            output += `\n<tool_call name="${item.name}" status="${item.status}">\n${args}\n</tool_call>\n`;
            hasContent = true;
        }
    }
    // Only show thinking if absolutely NO content (text or tools) has been produced yet
    if (!hasContent && !state.finished) return { type: 'thinking' };
    return { type: 'text', content: output, stats: state.stats };
}

async function sendReply(roomId, conversationId, content, isBot = true, senderId = AGENT_ID) {
    let payload = content;
    if (typeof content === 'string' && content.trim().startsWith('{')) {
        try { payload = JSON.parse(content); } catch (e) {}
    }

    if (typeof payload === 'object' && payload !== null) {
        if (['DATA', 'SYSTEM', 'STATUS', 'ERROR', 'UI_COMMAND'].includes(payload.type)) {
            payload.ephemeral = true;
        }
        payload = JSON.stringify(payload);
    } else {
        payload = String(content);
    }

    console.log(`[Agent] Sending reply to ${roomId}/${conversationId}...`);
    
    try {
        // Ensure conversation exists
        if (conversationId && conversationId.length === 36) {
             const { error: upsertErr } = await supabase.from('conversations').upsert({ 
                 id: conversationId, 
                 app_id: roomId === 'home' ? 'alex' : roomId,
                 owner_id: '7ddfb2e4-2ac3-44cf-92dd-5f72789ba93f' // System placeholder
             }, { onConflict: 'id' });
             if (upsertErr) console.error("[Agent] Conversation Upsert Error:", upsertErr);
        }

        const { data, error } = await supabase.from('messages').insert({
            room_id: roomId,
            conversation_id: conversationId,
            content: payload,
            sender_id: senderId,
            is_bot: isBot
        }).select();

        if (error) console.error("Send Error:", error);
        return data?.[0]?.id;
    } catch (e) {
        console.error("SendReply Exception:", e);
        return null;
    }
}

async function updateReply(messageId, content) {
    await supabase.from('messages').update({ content }).eq('id', messageId);
}

async function deleteReply(messageId) {
    await supabase.from('messages').delete().eq('id', messageId);
}

async function updateConversationTitle(conversationId, history) {
    try {
        const historyText = history.map(m => `${m.is_bot ? 'Bot' : 'User'}: ${m.content}`).join('\n');
        const prompt = `Summarize the following chat into a 3-5 word title. Respond ONLY with title text.\n\n${historyText}`;
        const result = await GeminiBridge.quickQuery('titling', prompt);
        const title = (result.content || "").trim();
        if (title) await supabase.from('conversations').update({ title }).eq('id', conversationId);
    } catch (e) {}
}

// --- AGENTS ---
const rafiAgent = new RafiAgent({ send: sendReply, update: updateReply, delete: deleteReply });
const nanieAgent = new NanieAgent({ send: sendReply, update: updateReply, delete: deleteReply });

const processedMessageIds = new Set();

export async function handleMessage(message) {
    const roomId = message.room_id || 'home';
    let conversationId = message.conversation_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!conversationId || !uuidRegex.test(conversationId)) {
        if (message.sender_id && uuidRegex.test(message.sender_id)) conversationId = message.sender_id;
        else conversationId = null;
    }
    message.conversation_id = conversationId;

    // Command Interceptors
    const replyInterface = {
        send: (content, isBot, senderId) => sendReply(roomId, conversationId, content, isBot, senderId),
        update: (id, content) => updateReply(id, content),
        delete: (id) => deleteReply(id)
    };

    try {
        const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
        if (content && content.action) {
            if (roomId === 'rafi' || ['INIT_SESSION', 'LOGIN', 'FETCH', 'SUBMIT_OTP', 'INPUT_RESPONSE'].includes(content.action || content.type)) {
                const handled = await rafiAgent.handleMessage(message, replyInterface);
                if (handled) {
                    if (content.debug !== true) await deleteReply(message.id);
                    return;
                }
            }
            if (roomId === 'nanie' || ['GET_STATUS', 'ADD_EVENT', 'LIST_GROUPS', 'SELECT_GROUP'].includes(content.action)) {
                const handled = await nanieAgent.handleMessage(message, replyInterface);
                if (handled) {
                    if (content.debug !== true) await deleteReply(message.id);
                    return;
                }
            }
        }
    } catch (e) {}

    // --- GEMINI FLOW ---
    let fullPrompt = "";

    try {
        const chatHistory = await getChatContext(conversationId, 3, message.id);
        
        if (roomId === 'rafi') {
            const snapshot = await rafiAgent.getAccountData(conversationId);
            let stateStr = JSON.stringify(snapshot);
            if (stateStr.length > 5000) stateStr = stateStr.substring(0, 5000) + "... [TRUNCATED]";
            fullPrompt = `SYSTEM: You are Rafi. Use ONLY the 'rafi' skill. DO NOT use any other tools like read_file, list_dir, or run_shell_command.
CURRENT_STATE: ${stateStr}
RECENT_HISTORY:
${chatHistory}
USER: ${message.content}`;
        } else if (roomId === 'nanie') {
            const snapshot = await nanieAgent.getContextSnapshot(conversationId);
            let stateStr = JSON.stringify(snapshot);
            if (stateStr.length > 5000) stateStr = stateStr.substring(0, 5000) + "... [TRUNCATED]";
            fullPrompt = `SYSTEM: You are Nanie. Use ONLY the 'nanie' skill. DO NOT use any other tools like read_file, list_dir, or run_shell_command.
CURRENT_STATE: ${stateStr}
RECENT_HISTORY:
${chatHistory}
USER: ${message.content}`;
        } else {
            fullPrompt = `RECENT_HISTORY:\n${chatHistory}\nUSER: ${message.content}`;
        }
    } catch (e) { console.error("Prompt Build Error:", e); }

    try {
        let currentPrompt = fullPrompt;
        let turns = 0;
        const maxTurns = 5;

        while (turns < maxTurns) {
            // Fresh state for EACH turn to ensure distinct bubbles
            const state = { timeline: [], stats: null, finished: false, toolResults: [] };
            const messageId = await sendReply(roomId, conversationId, JSON.stringify({ type: 'thinking' }));
            if (!messageId) break;

            let lastUpdate = Date.now();
            const updateDB = async (force = false) => {
                if (force || (Date.now() - lastUpdate > 800)) { 
                    await updateReply(messageId, JSON.stringify(buildContent(state)));
                    lastUpdate = Date.now();
                }
            };

            const eventHandler = async (event) => {
                let needsUpdate = false;
                if (event.type === 'tool_use') {
                    const args = event.parameters || event.tool_args || event.args || {};
                    const toolCallId = event.tool_id;
                    state.timeline.push({ type: 'tool', id: toolCallId, name: event.tool_name, args, status: 'running' });
                    needsUpdate = true;
                    await updateDB(true);

                    let result = null;
                    let handled = false;
                    try {
                        if (event.tool_name === 'request_user_input') {
                            await sendReply(roomId, conversationId, { type: 'REQUEST_INPUT', fields: args.fields || [], submitLabel: args.submitLabel || 'Submit', ephemeral: true });
                            result = "Input request displayed.";
                            state.hasInteractive = true;
                            handled = true;
                        } else if (event.tool_name === 'execute_ui_action') {
                            const cmd = (roomId === 'rafi' && args.action === 'refresh') ? { type: 'UI_COMMAND', command: 'REFRESH_DATA' } :
                                        (roomId === 'nanie' && args.action === 'link_whatsapp') ? { type: 'UI_COMMAND', command: 'SHOW_GROUPS' } :
                                        (roomId === 'nanie' && args.action === 'add_event') ? { type: 'UI_COMMAND', command: 'SHOW_ADD_EVENT', params: args.parameters } : null;
                            if (cmd) { cmd.ephemeral = true; await sendReply(roomId, conversationId, cmd); result = "UI action triggered."; handled = true; }
                        } else if (roomId === 'rafi') {
                            const data = await rafiAgent.getAccountData(conversationId);
                            if (event.tool_name === 'get_account_balance') { result = JSON.stringify(data?.accounts || "No data"); handled = true; }
                            else if (event.tool_name === 'search_transactions') {
                                const q = (args.query || "").toLowerCase();
                                const matches = [];
                                data?.accounts.forEach(a => (a.txns || []).forEach(t => { if (!q || t.description.toLowerCase().includes(q)) matches.push(t); }));
                                result = JSON.stringify(matches.slice(0, 50));
                                handled = true;
                            }
                        } else if (roomId === 'nanie' && event.tool_name === 'get_recent_events') {
                            const evs = await nanieAgent.getContext(conversationId);
                            result = JSON.stringify(evs.slice(-(args.limit || 20)));
                            handled = true;
                        }
                    } catch (e) { result = "Error: " + e.message; handled = true; }

                    if (handled) {
                        const t = state.timeline.find(x => x.type === 'tool' && x.id === toolCallId);
                        if (t) t.status = 'success';
                        state.toolResults.push({ name: event.tool_name, result });
                        needsUpdate = true;
                    }
                }
                
                if (event.type === 'tool_result') {
                    const t = state.timeline.find(x => x.type === 'tool' && x.id === event.tool_id);
                    if (t) {
                        t.status = event.status || 'success';
                        needsUpdate = true;
                    }
                }
                
                if (event.type === 'message' && event.role === 'assistant' && event.content) {
                    const last = state.timeline[state.timeline.length - 1];
                    if (last && last.type === 'text') last.content += event.content;
                    else state.timeline.push({ type: 'text', content: event.content });
                    needsUpdate = true;
                }

                if (event.type === 'result') {
                    state.stats = event.stats;
                    needsUpdate = true;
                }
                await updateDB(needsUpdate);
            };

            state.hasInteractive = false;
            state.toolResults = [];
            
            await runGemini(conversationId, currentPrompt, eventHandler);
            
            // Final update for this bubble
            state.finished = true;
            await updateDB(true);

            if (state.toolResults.length > 0 && !state.hasInteractive) {
                currentPrompt = "Tool Results:\n" + state.toolResults.map(r => `${r.name}: ${r.result}`).join("\n");
                turns++;
                console.log(`[Agent] [${conversationId}] Multi-turn: ${turns} (New Bubble Triggered)`);
            } else {
                break;
            }
        }
    } catch (e) {
        await sendReply(roomId, conversationId, JSON.stringify({ type: 'text', content: `\n\n❌ **Error:** ${e.message}` }));
    }
}

// --- INITIALIZATION ---
async function fetchUnreadMessages() {
    try {
        const { data: messages } = await pollingSupabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
        const latest = new Map();
        messages?.forEach(m => { if (!latest.has(m.conversation_id)) latest.set(m.conversation_id, m); });
        for (const [id, m] of latest) {
            if (!m.is_bot && m.sender_id !== AGENT_ID && !processedMessageIds.has(m.id)) {
                processedMessageIds.add(m.id);
                handleMessage(m);
            }
        }
    } catch (e) {}
}

setInterval(fetchUnreadMessages, 10000);
fetchUnreadMessages();

supabase.channel('public:messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
    const msg = payload.new;
    if (!processedMessageIds.has(msg.id) && !msg.is_bot && msg.sender_id !== AGENT_ID) {
        processedMessageIds.add(msg.id);
        handleMessage(msg);
    }
}).subscribe();

console.log("[Agent] Alex-Bot Started.");

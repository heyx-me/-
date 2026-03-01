import { spawn } from 'child_process';
import { createServer } from 'net';
import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCKET_PATH = path.join(__dirname, '../.gemini/tmp/gemini_bridge.sock');
const SESSION_MAP_PATH = path.join(__dirname, '../.gemini/session_map.json');

const QUEUES = new Map(); // conversationId -> { tasks: [], processing: false }

// Ensure directories exist
const tmpDir = path.dirname(SOCKET_PATH);
if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

function getGeminiSessionId(conversationId) {
    try {
        if (existsSync(SESSION_MAP_PATH)) {
            const map = JSON.parse(readFileSync(SESSION_MAP_PATH, 'utf-8'));
            return map[conversationId];
        }
    } catch (e) { console.error('[Manager] Session map read error:', e); }
    return null;
}

function saveGeminiSessionId(conversationId, geminiId) {
    try {
        let map = {};
        if (existsSync(SESSION_MAP_PATH)) {
            map = JSON.parse(readFileSync(SESSION_MAP_PATH, 'utf-8'));
        }
        map[conversationId] = geminiId;
        writeFileSync(SESSION_MAP_PATH, JSON.stringify(map, null, 2));
    } catch (e) { console.error('[Manager] Session map write error:', e); }
}

const server = createServer((socket) => {
    let socketBuffer = '';
    socket.on('data', (data) => {
        socketBuffer += data.toString();
        const lines = socketBuffer.split('\n');
        socketBuffer = lines.pop();
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const { sessionId: conversationId, prompt } = JSON.parse(line);
                enqueueRequest(conversationId, prompt, socket);
            } catch (e) { console.error('[Manager] JSON parse error:', e.message); }
        }
    });
});

function enqueueRequest(conversationId, prompt, socket) {
    if (!QUEUES.has(conversationId)) {
        QUEUES.set(conversationId, { tasks: [], processing: false });
    }
    const queue = QUEUES.get(conversationId);
    queue.tasks.push({ prompt, socket });
    processQueue(conversationId);
}

async function processQueue(conversationId) {
    const queue = QUEUES.get(conversationId);
    if (!queue || queue.processing || queue.tasks.length === 0) return;

    queue.processing = true;
    const { prompt, socket } = queue.tasks.shift();

    try {
        await runGeminiTurn(conversationId, prompt, socket);
    } catch (e) {
        console.error(`[Manager] [${conversationId}] Turn failed:`, e.message);
        if (socket.writable) socket.write(JSON.stringify({ type: 'error', content: e.message }) + '\n');
    } finally {
        queue.processing = false;
        processQueue(conversationId);
    }
}

function runGeminiTurn(conversationId, prompt, socket, forceFresh = false) {
    return new Promise((resolve, reject) => {
        const geminiId = forceFresh ? null : getGeminiSessionId(conversationId);
        const args = ['-p', prompt, '--yolo', '--output-format', 'stream-json'];
        
        if (geminiId) {
            console.log(`[Manager] [${conversationId}] Resuming: ${geminiId}`);
            args.push('--resume', geminiId);
        } else {
            console.log(`[Manager] [${conversationId}] Starting Fresh`);
        }

        const proc = spawn('gemini', args, {
            cwd: process.cwd(),
            shell: false,
            env: { ...process.env, PAGER: 'cat' }
        });

        let stdoutBuffer = '';
        let hasSavedId = false;
        let isInvalidSession = false;

        const timeout = setTimeout(() => {
            console.error(`[Manager] [${conversationId}] Turn Timeout (900s)!`);
            proc.kill();
            reject(new Error('Gemini CLI Timeout'));
        }, 900000);

        proc.stdout.on('data', (chunk) => {
            stdoutBuffer += chunk.toString();
            const lines = stdoutBuffer.split('\n');
            stdoutBuffer = lines.pop();
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                
                const startIdx = trimmed.indexOf('{');
                if (startIdx === -1) continue;

                const jsonStr = trimmed.substring(startIdx);
                if (socket.writable) socket.write(jsonStr + '\n');
                
                try {
                    const event = JSON.parse(jsonStr);
                    if (event.type === 'init' && event.session_id && !hasSavedId) {
                        saveGeminiSessionId(conversationId, event.session_id);
                        hasSavedId = true;
                    }
                } catch (e) {}
            }
        });

        proc.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Invalid session identifier')) isInvalidSession = true;
            console.error(`[Gemini CLI:${conversationId} stderr] ${msg.trim()}`);
        });

        proc.on('close', async (code) => {
            clearTimeout(timeout);
            if (code === 42 && isInvalidSession && !forceFresh) {
                console.log(`[Manager] [${conversationId}] Session invalid, retrying fresh...`);
                try {
                    await runGeminiTurn(conversationId, prompt, socket, true);
                    resolve();
                } catch (e) { reject(e); }
            } else if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Exit code ${code}`));
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

if (existsSync(SOCKET_PATH)) unlinkSync(SOCKET_PATH);
server.listen(SOCKET_PATH, () => console.log(`[Manager] Listening on ${SOCKET_PATH}`));

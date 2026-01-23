import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

config();

const execAsync = promisify(exec);

// --- CONFIGURATION ---
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
// Must use Service Key for backend logic (to bypass RLS if needed, though here we act as bot)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in .env.");
    process.exit(1);
}

const ROOM_ID = 'alex';
const AGENT_ID = 'alex-bot';

// --- TOOLS ---

// 1. File System Tools
const ROOT_DIR = process.cwd();

async function listApps() {
    try {
        const data = await fs.readFile(path.join(ROOT_DIR, 'apps.json'), 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function updateAppsManifest(appId, appName, appPath) {
    const apps = await listApps();
    const exists = apps.find(a => a.id === appId);
    if (!exists) {
        apps.push({ id: appId, name: appName, path: appPath });
        await fs.writeFile(path.join(ROOT_DIR, 'apps.json'), JSON.stringify(apps, null, 2));
        console.log(`[Manifest] Registered new app: ${appName}`);
    }
}

async function createFile(filePath, content) {
    const fullPath = path.join(ROOT_DIR, filePath);
    const dir = path.dirname(fullPath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content);
    console.log(`[FS] Created file: ${filePath}`);
    
    // Check if this looks like a new app entry point (index.html)
    if (filePath.endsWith('index.html')) {
        const parts = filePath.split('/');
        if (parts.length >= 2) {
            const folderName = parts[0]; // e.g., 'weather-app'
            // Simple heuristic: if we write index.html in a root subfolder, register it
            if (parts.length === 2) { 
                const niceName = folderName.charAt(0).toUpperCase() + folderName.slice(1);
                await updateAppsManifest(folderName, niceName, `/${folderName}/index.html`);
            }
        }
    }
    return `Successfully created ${filePath}`;
}

// 2. Git Tools
async function gitCommitAndPush(message) {
    try {
        await execAsync('git add .');
        await execAsync(`git commit -m "${message}"`);
        await execAsync('git push');
        return "Changes committed and pushed to GitHub.";
    } catch (e) {
        console.error("Git Error:", e);
        return `Git sync failed: ${e.message}`;
    }
}

// --- AI SETUP ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: `You are Alex, the Vibe Coder and primary agent of the heyx.me hub.
    
    YOUR MISSION:
    1. Help users build simple, single-purpose web apps (React/HTML/Tailwind) directly in this repo.
    2. Respond to chat messages.
    3. Manage the file system and Git.

    CAPABILITIES:
    - You can write files. When asked to build an app (e.g., "weather app"), always create a NEW FOLDER (e.g., 'weather/').
    - Apps MUST be "No-Build" compatible:
      - Use standard HTML5.
      - Import React via ESM (as seen in the project's index.html).
      - Do NOT use 'import' for CSS or images unless they are in the public folder.
      - Component structure: 'index.html' (entry) + 'app.jsx' (logic).
    
    IMPORTANT: When creating 'index.html', ALWAYS include this script at the end of the body to enable JSX transpilation:
    \`\`\`html
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW Fail', err));
      }
    </script>
    \`\`\`
    
    TOOLS:
    - createFile(path, content): Writes code to disk.
    - gitCommitAndPush(message): Syncs to GitHub.

    BEHAVIOR:
    - When asked to build something, plan it, then write the files.
    - After writing files, run the git sync tool to publish them.
    - Be concise and friendly.
    `,
    tools: [
        {
            functionDeclarations: [
                {
                    name: "createFile",
                    description: "Write content to a file. Use this to create HTML, JSX, CSS files.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            filePath: { type: "STRING", description: "Relative path (e.g., 'weather/index.html')" },
                            content: { type: "STRING", description: "The full file content" }
                        },
                        required: ["filePath", "content"]
                    }
                },
                {
                    name: "gitCommitAndPush",
                    description: "Stage, commit, and push all changes to GitHub.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            message: { type: "STRING", description: "Commit message" }
                        },
                        required: ["message"]
                    }
                }
            ]
        }
    ]
});

// --- AGENT LOOP ---

async function handleMessage(message) {
    console.log(`[Alex] Received: ${message.content}`);

    const chat = model.startChat({
        history: [
            // Minimal context history could be fetched from DB if needed
        ]
    });

    try {
        const result = await chat.sendMessage(message.content);
        const response = result.response;
        const text = response.text();
        
        // 1. Send text reply first (if any)
        if (text) {
            await sendReply(message.conversation_id || message.sender_id, text);
        }

        // 2. Handle Function Calls
        const calls = response.functionCalls();
        if (calls) {
            for (const call of calls) {
                console.log(`[Alex] Calling tool: ${call.name}`);
                
                let toolResult = "";
                if (call.name === "createFile") {
                    toolResult = await createFile(call.args.filePath, call.args.content);
                } else if (call.name === "gitCommitAndPush") {
                    toolResult = await gitCommitAndPush(call.args.message);
                }

                // Send tool output back to model (optional, or just notify user)
                // For now, let's just notify the user that the action is done.
                await sendReply(message.conversation_id || message.sender_id, `✅ Action completed: ${call.name}`);
                
                // Ideally, we loop back to the model with the tool output, 
                // but for a V1 vibe coder, fire-and-forget is often enough for the first pass.
            }
        }

    } catch (e) {
        console.error("Agent Error:", e);
        await sendReply(message.conversation_id || message.sender_id, "I encountered an error processing your request.");
    }
}

async function sendReply(conversationId, content) {
    await supabase.from('messages').insert({
        room_id: ROOM_ID,
        conversation_id: conversationId,
        content: content,
        sender_id: AGENT_ID,
        is_bot: true
    });
}

// --- MAIN ---
console.log("[Alex] Agent starting...");

supabase
    .channel('public:messages')
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `room_id=eq.${ROOM_ID}` 
    }, (payload) => {
        const msg = payload.new;
        if (!msg.is_bot && msg.sender_id !== AGENT_ID) {
            handleMessage(msg);
        }
    })
    .subscribe((status) => {
        console.log(`[Alex] Listening on room '${ROOM_ID}'... Status: ${status}`);
    });

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { config } from 'dotenv';
import * as fs from 'fs';

config(); // Load environment variables if needed

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Helper Functions ---

/**
 * Safer execution of shell commands using spawn (avoids shell injection).
 * @param {string} command - The command to run (e.g., 'git').
 * @param {string[]} args - The arguments for the command.
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
const runCommand = (command, args) => new Promise((resolve) => {
    const process = spawn(command, args, { cwd: __dirname });
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => stdout += data);
    process.stderr.on('data', (data) => stderr += data);

    process.on('close', (code) => {
        if (code === 0) resolve({ success: true, output: stdout.trim() });
        else resolve({ success: false, error: stderr.trim() || 'Unknown error' });
    });
});

// --- Git API ---

app.get('/api/git/status', async (req, res) => {
    const result = await runCommand('git', ['status', '--porcelain']);
    res.json(result);
});

app.get('/api/git/branches', async (req, res) => {
    const result = await runCommand('git', ['branch', '--list']);
    if (!result.success) return res.status(500).json(result);
    
    const branches = result.output.split('\n').map(line => {
        const isCurrent = line.startsWith('*');
        return {
            name: line.replace('*', '').trim(),
            current: isCurrent
        };
    });
    res.json({ success: true, branches });
});

app.post('/api/git/checkout', async (req, res) => {
    const { branch } = req.body;
    if (!branch) return res.status(400).json({ error: 'Branch name required' });
    const result = await runCommand('git', ['checkout', branch]);
    res.json(result);
});

app.post('/api/git/branch', async (req, res) => {
    const { branch } = req.body;
    if (!branch) return res.status(400).json({ error: 'Branch name required' });
    const result = await runCommand('git', ['checkout', '-b', branch]);
    res.json(result);
});

app.post('/api/git/commit', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message required' });
    
    // Add all changes first
    const addResult = await runCommand('git', ['add', '.']);
    if (!addResult.success) return res.status(500).json(addResult);

    const commitResult = await runCommand('git', ['commit', '-m', message]);
    res.json(commitResult);
});

app.post('/api/git/push', async (req, res) => {
    const result = await runCommand('git', ['push']);
    res.json(result);
});

// --- Gemini CLI Integration ---

app.post('/api/chat', async (req, res) => {
    const { message, cwd } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    // Validate CWD (Must be within project root)
    let targetDir = __dirname;
    if (cwd) {
        const requestedDir = path.resolve(__dirname, cwd);
        if (requestedDir.startsWith(__dirname) && fs.existsSync(requestedDir)) {
            targetDir = requestedDir;
        } else {
            console.warn(`[Security] Invalid or unsafe CWD requested: ${cwd}`);
            // Fallback to root or error? For now, fallback to root but log it.
        }
    }

    console.log(`[Gemini] Processing in ${targetDir}: ${message.substring(0, 50)}...`);

    // Spawn the gemini CLI process
    // We use --yolo to auto-approve tools (like file edits) since this is an agentic interface
    const child = spawn('gemini', ['-p', message, '--yolo', '--output-format', 'json'], {
        cwd: targetDir,
        shell: false
    });

    let stdout = '';
    let stderr = '';

    // If the process hangs, kill it after 60 seconds
    const timeout = setTimeout(() => {
        child.kill();
        if (!res.headersSent) {
            res.status(504).json({ error: 'Gemini CLI timed out' });
        }
    }, 60000);

    // Write to stdin not needed since we used -p, but good practice to end it.
    child.stdin.end();

    child.stdout.on('data', (data) => stdout += data);
    child.stderr.on('data', (data) => stderr += data);

    child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code !== 0) {
            console.error(`[Gemini] Error (code ${code}): ${stderr}`);
            return res.status(500).json({
                error: 'Gemini CLI failed',
                details: stderr
            });
        }

        try {
            // Attempt to find the JSON in the output (ignoring potential logs/noise)
            let jsonResult = null;
            let startIndex = stdout.indexOf('{');
            const endIndex = stdout.lastIndexOf('}');
            
            while (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
                try {
                    const potentialJson = stdout.substring(startIndex, endIndex + 1);
                    const parsed = JSON.parse(potentialJson);
                    
                    // Check if this looks like our expected schema
                    if (parsed.response || parsed.session_id || parsed.stats) {
                        jsonResult = parsed;
                        break;
                    }
                    startIndex = stdout.indexOf('{', startIndex + 1);
                } catch (e) {
                    startIndex = stdout.indexOf('{', startIndex + 1);
                }
            }
            
            if (jsonResult) {
                res.json({ success: true, response: jsonResult.response, stats: jsonResult.stats });
            } else {
                // Fallback if no JSON found
                res.json({ success: true, response: stdout.trim() });
            }
        } catch (e) {
            console.error('[Gemini] Parse error:', e);
            res.status(500).json({ error: 'Failed to parse Gemini output', raw: stdout });
        }
    });
});

// --- Logs Viewer ---

app.get('/logs', (req, res) => {
    const LOG_DIR = path.join(__dirname, 'logs');
    if (!fs.existsSync(LOG_DIR)) return res.send('No logs directory found.');

    // Find the latest log file
    const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('session-'));
    if (files.length === 0) return res.send('No log files found.');

    const latest = files.sort().reverse()[0]; // Sort descending (newest first)
    const content = fs.readFileSync(path.join(LOG_DIR, latest), 'utf-8');

    res.send(`
        <html>
        <head>
            <title>Heyx Hub Logs - ${latest}</title>
            <meta http-equiv="refresh" content="5"> <!-- Auto-refresh every 5s -->
            <style>
                body { background: #1e1e1e; color: #d4d4d4; font-family: monospace; padding: 20px; }
                pre { white-space: pre-wrap; word-wrap: break-word; }
                .timestamp { color: #569cd6; }
                .server { color: #4ec9b0; }
                .agent { color: #ce9178; }
            </style>
        </head>
        <body>
            <h1>Log: ${latest}</h1>
            <pre>${content
                .replace(/\[Server\]/g, '<span class="server">[Server]</span>')
                .replace(/\[Agent\]/g, '<span class="agent">[Agent]</span>')
            }</pre>
        </body>
        </html>
    `);
});

// --- Static Serving & Security ---

// Middleware to block sensitive files
const BLACKLIST = ['server.js', 'package.json', 'package-lock.json', '.env', 'agent.js', '.gitignore'];

app.use((req, res, next) => {
    if (BLACKLIST.includes(path.basename(req.path))) {
        return res.status(403).send('Access Denied');
    }
    next();
});

// Serve the root directory statically
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Heyx Hub is running!`);
    console.log(`➜  Local:   http://localhost:${PORT}/`);
});
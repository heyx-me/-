import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ quiet: true }); // Load environment variables if needed

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

app.post('/api/git/stage', async (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'Files array required' });
    const result = await runCommand('git', ['add', ...files]);
    res.json(result);
});

app.post('/api/git/commit', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message required' });
    const result = await runCommand('git', ['commit', '-m', message]);
    res.json(result);
});

// --- Auth Proxy ---
// Special handling for sensitive operations that bypass Supabase
app.all('/proxy/rafi/*', (req, res, next) => {
    // This is a placeholder for the Serveo/Localtunnel proxy logic
    // In a real scenario, this would route to the Agent's local port
    next();
});

// Serve static files from the root directory
// Middleware to prevent access to sensitive files
app.use((req, res, next) => {
    const sensitiveFiles = ['.env', 'subscriptions.json', 'package-lock.json'];
    if (sensitiveFiles.some(file => req.path.includes(file))) {
        return res.status(403).send('Access Denied');
    }
    next();
});

// Serve the root directory statically
app.use(express.static(path.join(__dirname, '.')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running at http://localhost:${PORT}/`);
});

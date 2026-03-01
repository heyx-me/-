import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PID_FILE = path.join(__dirname, '../.gemini/pids.json');
const LOG_DIR = path.join(__dirname, '../logs');

// Ensure log dir exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// 1. Cleanup Old Processes
console.log(chalk.blue('🧹 Cleaning up old processes...'));

if (fs.existsSync(PID_FILE)) {
    try {
        const pids = JSON.parse(fs.readFileSync(PID_FILE, 'utf-8'));
        
        // Kill Bridge
        if (pids.bridge) {
            try {
                process.kill(pids.bridge);
                console.log(chalk.gray(`   Killed old Bridge (PID ${pids.bridge})`));
            } catch (e) { /* ignore if already dead */ }
        }

        // Kill Server
        if (pids.server) {
            try {
                process.kill(pids.server);
                console.log(chalk.gray(`   Killed old Server (PID ${pids.server})`));
            } catch (e) { /* ignore if already dead */ }
        }
        
        // Kill Agent
        if (pids.agent) {
            try {
                process.kill(pids.agent);
                console.log(chalk.gray(`   Killed old Agent (PID ${pids.agent})`));
            } catch (e) { /* ignore */ }
        }

        // Remove file
        fs.unlinkSync(PID_FILE);
    } catch (e) {
        console.warn(chalk.yellow('⚠ Failed to clean up old PIDs:', e.message));
    }
}

// 2. Run Pre-flight Check
console.log(chalk.blue('🔍 Running Checks...'));
try {
    execSync('node scripts/check.js', { stdio: 'inherit' });
} catch (e) {
    console.error(chalk.red('❌ Checks failed. Aborting start.'));
    process.exit(1);
}

// 3. Start Processes & Logging
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOG_DIR, `session-${timestamp}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

console.log(chalk.blue(`📝 Logging to: ${logFile}`));

// Helper to spawn and pipe
function startService(name, command, args, colorFunc) {
    const proc = spawn(command, args, {
        cwd: path.join(__dirname, '..'),
        shell: false,
        env: { ...process.env, FORCE_COLOR: '1' } // Force color for logs
    });

    console.log(chalk.green(`🚀 Started ${name} (PID ${proc.pid})`));

    const prefix = colorFunc(`[${name}] `);

    proc.stdout.on('data', (data) => {
        const str = data.toString().trim();
        if (!str) return;
        // Stream to console
        process.stdout.write(prefix + str.replace(/\n/g, '\n' + prefix) + '\n');
        // Write to file (simple append)
        logStream.write(`[${new Date().toISOString()}] [${name}] ${str}\n`);
    });

    proc.stderr.on('data', (data) => {
        const str = data.toString().trim();
        if (!str) return;
        process.stderr.write(prefix + chalk.red(str.replace(/\n/g, '\n' + prefix)) + '\n');
        logStream.write(`[${new Date().toISOString()}] [${name}] ERROR: ${str}\n`);
    });

    proc.on('close', (code) => {
        console.log(chalk.yellow(`\n⚠️ ${name} exited with code ${code}`));
        logStream.write(`\n[${new Date().toISOString()}] [${name}] Exited with code ${code}\n`);
    });

    return proc;
}

const bridgeProc = startService('Bridge', 'node', ['lib/gemini-manager.js'], chalk.yellow);
const serverProc = startService('Server', 'node', ['server.js'], chalk.cyan);
let agentProc = startService('Agent', 'node', ['agent.js'], chalk.magenta);

// 4. File Watcher (Auto-restart Agent)
// We are selective to avoid ENOSPC (System limit for number of file watchers reached)
const WATCH_DIRS = [
    { path: '.', recursive: false },
    { path: 'rafi', recursive: false },
    { path: 'nanie', recursive: false },
    { path: 'rafi/components', recursive: false },
    { path: 'rafi/contexts', recursive: false },
    { path: 'rafi/hooks', recursive: false },
    { path: 'rafi/layouts', recursive: false },
    { path: 'rafi/utils', recursive: false },
    { path: 'lib', recursive: true },
    { path: 'contexts', recursive: true },
    { path: 'hooks', recursive: true },
    { path: 'utils', recursive: true }
];
const EXTENSIONS = ['.js', '.mjs', '.jsx'];
const IGNORE_PATHS = ['node_modules', '.git', 'logs', 'user_data', 'memory', 'auth_info', 'package-lock.json', 'pids.json', 'tokens.json'];
let restartTimeout = null;

console.log(chalk.blue('👀 Watching for code changes (Selective)...'));

WATCH_DIRS.forEach(config => {
    const dirPath = path.join(__dirname, '..', config.path);
    if (!fs.existsSync(dirPath)) return;

    try {
        fs.watch(dirPath, { recursive: config.recursive }, (eventType, filename) => {
            if (!filename) return;
            const ext = path.extname(filename);
            
            // 1. Only watch code files
            if (!EXTENSIONS.includes(ext)) return;
            
            // 2. Ignore data-oriented paths/files
            const fullPath = path.join(config.path, filename);
            if (IGNORE_PATHS.some(ignore => fullPath.includes(ignore))) return;

            if (restartTimeout) clearTimeout(restartTimeout);
            restartTimeout = setTimeout(() => {
                console.log(chalk.cyan(`\n🔄 Code change detected in ${config.path}/${filename}. Restarting Agent...`));
                if (agentProc) {
                    try {
                        agentProc.kill();
                    } catch (e) {}
                    agentProc = startService('Agent', 'node', ['agent.js'], chalk.magenta);
                    
                    // Update PID file
                    try {
                        const pids = JSON.parse(fs.readFileSync(PID_FILE, 'utf-8'));
                        pids.agent = agentProc.pid;
                        fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
                    } catch (e) {}
                }
            }, 1500); // 1.5s debounce
        });
    } catch (e) {
        console.warn(chalk.yellow(`⚠ Could not watch directory ${dir}:`, e.message));
    }
});

// Save PIDs
fs.writeFileSync(PID_FILE, JSON.stringify({
    bridge: bridgeProc.pid,
    server: serverProc.pid,
    agent: agentProc.pid
}, null, 2));

// Handle Exit (Ctrl+C)
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Stopping...'));
    bridgeProc.kill();
    serverProc.kill();
    if (agentProc) agentProc.kill();
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    process.exit();
});
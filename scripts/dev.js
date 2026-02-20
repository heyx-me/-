import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOOLS_DIR = path.join(__dirname, 'tools');

const args = process.argv.slice(2);
const command = args[0];
const toolName = args[1];

function listTools() {
    console.log(chalk.blue('🛠  Available Dev Tools:'));
    if (!fs.existsSync(TOOLS_DIR)) {
        console.log(chalk.gray('   (No tools found in scripts/tools)'));
        return;
    }

    const files = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('.js'));
    files.forEach(f => {
        const name = f.replace('.js', '');
        console.log(`   - ${chalk.cyan(name)}`);
    });
    console.log('');
    console.log(`Usage: ${chalk.yellow('npm run dev <tool_name>')} or ${chalk.yellow('node scripts/dev.js run <tool_name>')}`);
}

function runTool(name, toolArgs) {
    if (!name) {
        console.error(chalk.red('❌ Please specify a tool name.'));
        listTools();
        process.exit(1);
    }

    const toolFile = path.join(TOOLS_DIR, name + '.js');
    if (!fs.existsSync(toolFile)) {
        // Try exact match
        if (fs.existsSync(path.join(TOOLS_DIR, name))) {
             runScript(path.join(TOOLS_DIR, name), toolArgs);
             return;
        }
        console.error(chalk.red(`❌ Tool '${name}' not found.`));
        listTools();
        process.exit(1);
    }

    runScript(toolFile, toolArgs);
}

function runScript(filePath, scriptArgs) {
    console.log(chalk.blue(`🚀 Running ${path.basename(filePath)}...`));
    
    const proc = spawn('node', [filePath, ...scriptArgs], {
        stdio: 'inherit',
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    proc.on('close', (code) => {
        if (code !== 0) {
            console.log(chalk.red(`\n(Tool exited with code ${code})`));
        } else {
            console.log(chalk.green('\n✓ Done'));
        }
    });
}

// CLI Router
switch (command) {
    case 'list':
    case undefined:
        listTools();
        break;
    case 'run':
        runTool(toolName, args.slice(2));
        break;
    default:
        // Shortcut: if command matches a tool name, run it
        if (fs.existsSync(path.join(TOOLS_DIR, command + '.js'))) {
            runTool(command, args.slice(1));
        } else {
            console.error(chalk.red(`Unknown command: ${command}`));
            listTools();
        }
}
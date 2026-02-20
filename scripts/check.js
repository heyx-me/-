import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

console.log(chalk.blue('🔍 Running Pre-flight Checks...'));

const filesToCheck = [
    'app.jsx',
    'agent.js',
    'server.js',
    'nanie/app.jsx',
    'rafi/app.jsx',
    'nanie/agent.mjs',
    'rafi/agent.js'
];

let hasErrors = false;

// 1. Check .env
if (!fs.existsSync('.env')) {
    console.error(chalk.red('❌ .env file missing!'));
    hasErrors = true;
} else {
    console.log(chalk.green('✓ .env file found'));
}

// 2. Syntax Check
async function checkSyntax() {
    console.log(chalk.blue('   Verifying syntax...'));
    
    for (const file of filesToCheck) {
        if (!fs.existsSync(file)) {
            console.warn(chalk.yellow(`⚠ File not found (skipping): ${file}`));
            continue;
        }

        try {
            await esbuild.build({
                entryPoints: [file],
                bundle: false, // Just check syntax
                write: false,  // Don't output files
                format: 'esm',
                loader: { '.js': 'jsx', '.jsx': 'jsx', '.mjs': 'js' } // Treat JS as JSX to allow mixed content
            });
            console.log(chalk.green(`✓ ${file} passed syntax check`));
        } catch (e) {
            console.error(chalk.red(`❌ Syntax error in ${file}:`));
            // esbuild prints the error details to stderr automatically
            hasErrors = true;
        }
    }
}

checkSyntax().then(() => {
    if (hasErrors) {
        console.error(chalk.red('\n💥 Pre-flight check failed! Fix errors before starting.'));
        process.exit(1);
    } else {
        console.log(chalk.green('\n✨ All checks passed! Ready to launch.'));
        process.exit(0);
    }
});
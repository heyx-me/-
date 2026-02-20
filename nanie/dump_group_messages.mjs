
import { SimpleStore } from './store.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORE_FILE = path.join(__dirname, 'baileys_store.json');
const TARGET_GROUP = '120363425029379306@g.us';

async function run() {
    console.log(`Loading store from ${STORE_FILE}...`);
    const store = new SimpleStore(STORE_FILE);
    store.readFromFile();

    const messages = store.messages[TARGET_GROUP] || [];
    console.log(`Found ${messages.length} messages for group ${TARGET_GROUP}`);

    // Sort by timestamp
    messages.sort((a, b) => {
        const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
        const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
        return tA - tB; 
    });

    // Take last 50
    const recent = messages.slice(-50);
    
    fs.writeFileSync(path.join(__dirname, 'target_messages.json'), JSON.stringify(recent, null, 2));
    console.log(`Dumped ${recent.length} messages to target_messages.json`);
}

run();

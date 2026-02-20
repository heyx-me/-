import fs from 'fs';
const storePath = 'nanie/baileys_store.json';
const groupId = '120363425029379306@g.us';

try {
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const messages = data.messages[groupId] || [];
    
    console.log(`Total messages for ${groupId}: ${messages.length}`);
    
    // Sort by timestamp
    messages.sort((a, b) => {
        const tA = (typeof a.messageTimestamp === 'object' ? a.messageTimestamp.low : a.messageTimestamp);
        const tB = (typeof b.messageTimestamp === 'object' ? b.messageTimestamp.low : b.messageTimestamp);
        return tA - tB;
    });

    const last10 = messages.slice(-10);
    last10.forEach(m => {
        const ts = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp);
        console.log(`ID: ${m.key.id}, Time: ${new Date(ts * 1000).toISOString()}`);
    });

} catch (e) {
    console.error(e);
}
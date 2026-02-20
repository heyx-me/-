import fs from 'fs';
const storePath = 'nanie/baileys_store.json';

try {
    const data = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
    const groups = Object.values(data.chats)
        .filter(c => c.id.endsWith('@g.us'))
        .map(c => ({
            name: c.id, // we don't have contacts mapping easily here
            lastActivity: c.t ? new Date(c.t * 1000).toISOString() : 'Never'
        }))
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

    console.log('Top 10 active groups:');
    console.table(groups.slice(0, 10));

} catch (e) {
    console.error(e);
}
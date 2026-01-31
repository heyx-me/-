const fs = require('fs');

const STORE_FILE = './baileys_store.json';
const TARGET_JID = '120363425029379306@g.us';

class SimpleStore {
    constructor() {
        this.chats = {};
        this.contacts = {};
        this.file = STORE_FILE;
    }

    readFromFile() {
        if (fs.existsSync(this.file)) {
            try {
                console.log('Reading file...');
                const raw = fs.readFileSync(this.file, 'utf-8');
                console.log('Parsing JSON...');
                const data = JSON.parse(raw);
                this.chats = data.chats || {};
                this.contacts = data.contacts || {};
                console.log(`Loaded: ${Object.keys(this.chats).length} chats, ${Object.keys(this.contacts).length} contacts`);
            } catch (err) { console.error('Load store failed:', err); }
        } else {
            console.log('File not found');
        }
    }

    getChatName(jid) {
        const c = this.contacts[jid];
        const chat = this.chats[jid];
        
        console.log(`Lookup for ${jid}:`);
        console.log('Contact entry:', c);
        console.log('Chat entry:', chat);

        let name = (c?.name) || (c?.notify) || (chat?.name) || (chat?.subject);
        return name;
    }
}

const store = new SimpleStore();
store.readFromFile();
const name = store.getChatName(TARGET_JID);
console.log('Resulting Name:', name);

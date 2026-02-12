import fs from 'fs';

export class SimpleStore {
    constructor(filePath) {
        this.chats = {};
        this.messages = {};
        this.contacts = {};
        this.file = filePath;
    }

    readFromFile() {
        if (fs.existsSync(this.file)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
                this.chats = data.chats || {};
                this.messages = data.messages || {};
                this.contacts = data.contacts || {};
            } catch (err) { console.error('Load store failed:', err); }
        }
    }

    writeToFile() {
        fs.writeFileSync(this.file, JSON.stringify({
            chats: this.chats,
            messages: this.messages,
            contacts: this.contacts
        }, null, 2));
    }

    bind(ev) {
        ev.on('messaging-history.set', ({ chats, contacts, messages }) => {
            (contacts || []).forEach(c => this.contacts[c.id] = { ...this.contacts[c.id], ...c });
            (chats || []).forEach(c => {
                if (!this.chats[c.id]) this.chats[c.id] = { id: c.id, unread: 0, t: 0 };
            });
            (messages || []).forEach(msg => {
                const jid = msg.key.remoteJid;
                this._upsertMessage(jid, msg);
            });
        });

        ev.on('contacts.upsert', contacts => {
            contacts.forEach(c => this.contacts[c.id] = { ...this.contacts[c.id], ...c });
        });

        ev.on('messages.upsert', ({ messages, type }) => {
            if (type !== 'notify' && type !== 'append') return;
            messages.forEach(msg => {
                const jid = msg.key.remoteJid;
                this._upsertMessage(jid, msg);
            });
        });
    }

    _upsertMessage(jid, msg) {
        if (!jid) return;
        
        // Debug Log
        console.log(`[SimpleStore] Upsert ${jid} msg: ${msg.key.id}`);

        // Init chat if missing
        if (!this.chats[jid]) {
            this.chats[jid] = { id: jid, unread: 0, t: 0 };
        }

        // Init messages array
        if (!this.messages[jid]) this.messages[jid] = [];
        
        // Add message if unique
        if (!this.messages[jid].find(m => m.key.id === msg.key.id)) {
            this.messages[jid].push(msg);
        }

        // Update timestamp (t) if this message is newer
        const msgTime = (typeof msg.messageTimestamp === 'object' ? msg.messageTimestamp.low : msg.messageTimestamp);
        if (msgTime > this.chats[jid].t) {
            this.chats[jid].t = msgTime;
        }
    }

    getChatName(jid) {
        const c = this.contacts[jid];
        const chat = this.chats[jid];
        let name = (c?.name) || (c?.notify) || (chat?.name) || (chat?.subject);
        if (!name && jid) name = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        return name;
    }
    
    loadMessage(jid, id) {
        if (this.messages[jid]) {
            return this.messages[jid].find(m => m.key.id === id);
        }
        return null;
    }

    getGroups() {
        return Object.values(this.chats)
            .filter(c => c.id.endsWith('@g.us'))
            .map(c => ({
                id: c.id,
                name: this.getChatName(c.id),
                lastActivity: c.t
            }))
            .sort((a, b) => b.lastActivity - a.lastActivity);
    }
}

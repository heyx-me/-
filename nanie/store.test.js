import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SimpleStore } from './store.mjs';
import fs from 'fs';

// Mock fs
vi.mock('fs', () => ({
    default: {
        existsSync: () => false,
        writeFileSync: vi.fn(),
        readFileSync: () => '{}'
    }
}));

describe('SimpleStore', () => {
    let store;
    let ev;

    beforeEach(() => {
        store = new SimpleStore('test.json');
        // Mock event emitter
        ev = {
            listeners: {},
            on: (event, fn) => { ev.listeners[event] = fn; },
            emit: (event, data) => { if (ev.listeners[event]) ev.listeners[event](data); }
        };
        store.bind(ev);
    });

    it('should initialize chat with timestamp 0', () => {
        ev.emit('messaging-history.set', { 
            chats: [{ id: '123@g.us' }], 
            messages: [] 
        });
        expect(store.chats['123@g.us'].t).toBe(0);
    });

    it('should update chat timestamp on new message', () => {
        // Setup chat
        ev.emit('messaging-history.set', { 
            chats: [{ id: '123@g.us' }], 
            messages: [] 
        });

        // Incoming message (newer)
        const now = Date.now() / 1000;
        ev.emit('messages.upsert', {
            type: 'notify',
            messages: [{
                key: { remoteJid: '123@g.us', id: 'm1' },
                messageTimestamp: now
            }]
        });

        expect(store.chats['123@g.us'].t).toBe(now);
    });

    it('should filter and sort groups correctly', () => {
        // Setup chats with different timestamps
        store.chats = {
            'group1@g.us': { id: 'group1@g.us', t: 100 },
            'group2@g.us': { id: 'group2@g.us', t: 300 }, // Newest
            'person@s.whatsapp.net': { id: 'person', t: 500 }, // Not a group
            'group3@g.us': { id: 'group3@g.us', t: 200 }
        };
        store.contacts = {
            'group1@g.us': { name: 'G1' },
            'group2@g.us': { name: 'G2' },
            'group3@g.us': { name: 'G3' }
        };

        const groups = store.getGroups();
        
        expect(groups).toHaveLength(3);
        expect(groups[0].id).toBe('group2@g.us'); // 300
        expect(groups[1].id).toBe('group3@g.us'); // 200
        expect(groups[2].id).toBe('group1@g.us'); // 100
        expect(groups[0].name).toBe('G2');
    });
});

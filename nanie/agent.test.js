import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { NanieAgent } from './agent.mjs';
import { MappingManager } from './managers.mjs';

const TEST_DIR = './nanie/test_env_agent';
const MAPPINGS_FILE = path.join(TEST_DIR, 'mappings.json');
const MEMORY_DIR = path.join(TEST_DIR, 'memory');

// Mock dependencies
vi.mock('@whiskeysockets/baileys', () => ({
    makeWASocket: () => ({
        ev: { on: vi.fn() },
        sendMessage: vi.fn(),
    }),
    useMultiFileAuthState: () => Promise.resolve({ state: {}, saveCreds: vi.fn() }),
    fetchLatestBaileysVersion: () => Promise.resolve({ version: [1, 0, 0] }),
    DisconnectReason: {},
    Browsers: { macOS: () => 'Mac' }
}));

// Mock modules to point to test paths
vi.mock('./managers.mjs', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        MappingManager: class extends actual.MappingManager {
            constructor() { super(MAPPINGS_FILE); }
        },
        StorageManager: class extends actual.StorageManager {
            constructor() { super(MEMORY_DIR); }
        }
    };
});

// Mock Store
vi.mock('./store.mjs', () => {
    return {
        SimpleStore: class {
            constructor() { this.chats = {}; this.contacts = {}; this.messages = {}; }
            readFromFile() {}
            writeToFile() {}
            bind() {}
            getChatName(id) { return 'Mock Name'; }
            loadMessage() {}
            getGroups() { 
                return [{ id: 'g1@g.us', name: 'Mock Group', lastActivity: 100 }]; 
            }
        }
    };
});

describe('NanieAgent Integration', () => {
    let agent;
    let replyControl;

    beforeEach(async () => {
        // Setup Test Env
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_DIR, { recursive: true });
        
        replyControl = { send: vi.fn() };
        
        // Initialize Agent
        agent = new NanieAgent(replyControl);
        // Wait for init
        await new Promise(r => setTimeout(r, 100)); 
    });

    afterEach(() => {
        if (agent.updateInterval) clearInterval(agent.updateInterval);
        if (agent.saveInterval) clearInterval(agent.saveInterval);
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    });

    it('should REJECT messages from unmapped conversations', async () => {
        const message = {
            conversation_id: 'conv_unmapped',
            content: { action: 'GET_STATUS' }
        };

        await agent.handleMessage(message, replyControl);

        expect(replyControl.send).toHaveBeenCalledWith({
            type: 'SYSTEM',
            code: 'GROUP_SELECTION_REQUIRED',
            error: 'Group Selection Required',
            message: 'Please select a WhatsApp group to continue.'
        });
    });

    it('should PROCESS messages from mapped conversations', async () => {
        // Manually create mapping
        const manager = new MappingManager(MAPPINGS_FILE);
        await manager.load();
        await manager.setMapping('conv_mapped', { groupId: 'g1', groupName: 'Test' });

        // Re-init agent
        if (agent.updateInterval) clearInterval(agent.updateInterval);
        agent = new NanieAgent(replyControl);
        await new Promise(r => setTimeout(r, 100));

        const message = {
            conversation_id: 'conv_mapped',
            content: { action: 'GET_STATUS' }
        };

        await agent.handleMessage(message, replyControl);

        expect(replyControl.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'DATA',
            data: expect.objectContaining({ events: [] })
        }));
    });

    it('should ALLOW LIST_GROUPS even if unmapped', async () => {
        const message = {
            conversation_id: 'conv_new_user',
            content: { action: 'LIST_GROUPS' }
        };

        await agent.handleMessage(message, replyControl);

        expect(replyControl.send).toHaveBeenCalledWith({
            type: 'DATA',
            data: { 
                groups: [{ id: 'g1@g.us', name: 'Mock Group', lastActivity: 100 }] 
            }
        });
    });

    it('should HANDLE SELECT_GROUP action', async () => {
        const message = {
            conversation_id: 'conv_select_test',
            content: { 
                action: 'SELECT_GROUP',
                groupId: 'g1@g.us',
                groupName: 'Mock Group'
            }
        };

        await agent.handleMessage(message, replyControl);

        // Should return LINKED status
        expect(replyControl.send).toHaveBeenCalledWith({
            type: 'STATUS',
            text: 'LINKED'
        });

        // Verify mapping file
        const manager = new MappingManager(MAPPINGS_FILE);
        await manager.load();
        const mapping = manager.getGroup('conv_select_test');
        expect(mapping.groupId).toBe('g1@g.us');
    });
});
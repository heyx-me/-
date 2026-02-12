import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MappingManager, StorageManager } from './managers.mjs';

const TEST_DIR = './nanie/test_env';
const MAPPINGS_FILE = path.join(TEST_DIR, 'mappings.json');
const MEMORY_DIR = path.join(TEST_DIR, 'memory');

describe('Managers', () => {
    beforeEach(() => {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
        fs.mkdirSync(TEST_DIR, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    });

    describe('MappingManager', () => {
        it('should load empty mappings if file does not exist', async () => {
            const manager = new MappingManager(MAPPINGS_FILE);
            await manager.load();
            expect(manager.getAll()).toEqual({});
        });

        it('should save and load mappings', async () => {
            const manager = new MappingManager(MAPPINGS_FILE);
            await manager.load();
            
            const mapping = { groupId: 'g1', groupName: 'Test Group', mappedAt: Date.now() };
            await manager.setMapping('conv1', mapping);

            const manager2 = new MappingManager(MAPPINGS_FILE);
            await manager2.load();
            expect(manager2.getGroup('conv1')).toEqual(mapping);
        });

        it('should return null for unknown conversation', async () => {
            const manager = new MappingManager(MAPPINGS_FILE);
            await manager.load();
            expect(manager.getGroup('unknown')).toBeNull();
        });

        it('should support reverse lookup', async () => {
            const manager = new MappingManager(MAPPINGS_FILE);
            await manager.load();
            const mapping = { groupId: 'g1', groupName: 'Test Group', mappedAt: Date.now() };
            await manager.setMapping('conv1', mapping);
            
            expect(manager.getConversationId('g1')).toBe('conv1');
        });
    });

    describe('StorageManager', () => {
        it('should create group directory on initialization', async () => {
            const manager = new StorageManager(MEMORY_DIR);
            const timeline = await manager.getTimeline('g1');
            expect(timeline).toEqual([]);
            expect(fs.existsSync(path.join(MEMORY_DIR, 'g1'))).toBe(true);
        });

        it('should persist timeline events', async () => {
            const manager = new StorageManager(MEMORY_DIR);
            const event = { timestamp: 123, type: 'test', details: 'hello' };
            
            await manager.appendEvents('g1', [event]);
            
            // Reload to verify persistence
            const manager2 = new StorageManager(MEMORY_DIR);
            const timeline = await manager2.getTimeline('g1');
            expect(timeline).toHaveLength(1);
            expect(timeline[0]).toEqual(event);
        });

        it('should handle concurrent writes sequentially', async () => {
            const manager = new StorageManager(MEMORY_DIR);
            const events1 = [{ id: 1 }];
            const events2 = [{ id: 2 }];

            // Trigger two writes "simultaneously"
            const p1 = manager.appendEvents('g1', events1);
            const p2 = manager.appendEvents('g1', events2);

            await Promise.all([p1, p2]);

            const timeline = await manager.getTimeline('g1');
            expect(timeline).toHaveLength(2);
            // We don't strictly guarantee order between p1 and p2 if they start at exact same ms, 
            // but we guarantee no data loss.
            const ids = timeline.map(e => e.id).sort();
            expect(ids).toEqual([1, 2]);
        });

        it('should manage metadata', async () => {
            const manager = new StorageManager(MEMORY_DIR);
            await manager.updateMetadata('g1', { botName: 'Nanie' });
            
            let meta = await manager.getMetadata('g1');
            expect(meta.botName).toBe('Nanie');

            await manager.updateMetadata('g1', { other: 'value' });
            meta = await manager.getMetadata('g1');
            expect(meta.botName).toBe('Nanie'); // Merged
            expect(meta.other).toBe('value');
        });
    });
});

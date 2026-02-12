import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';

/**
 * Manages the mapping between internal conversation IDs and WhatsApp Group IDs.
 */
export class MappingManager {
    constructor(filePath) {
        this.filePath = filePath;
        this.mappings = new Map(); // conversation_id -> { groupId, groupName, ... }
    }

    async load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = await fsPromises.readFile(this.filePath, 'utf-8');
                const json = JSON.parse(data);
                this.mappings = new Map(Object.entries(json));
            } else {
                this.mappings = new Map();
            }
        } catch (error) {
            console.error('[MappingManager] Failed to load mappings:', error);
            this.mappings = new Map();
        }
    }

    async save() {
        try {
            const obj = Object.fromEntries(this.mappings);
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                await fsPromises.mkdir(dir, { recursive: true });
            }
            await fsPromises.writeFile(this.filePath, JSON.stringify(obj, null, 2));
        } catch (error) {
            console.error('[MappingManager] Failed to save mappings:', error);
        }
    }

    getAll() {
        return Object.fromEntries(this.mappings);
    }

    getGroup(conversationId) {
        return this.mappings.get(conversationId) || null;
    }

    async setMapping(conversationId, groupData) {
        this.mappings.set(conversationId, groupData);
        await this.save();
    }

    async deleteMapping(conversationId) {
        if (this.mappings.has(conversationId)) {
            this.mappings.delete(conversationId);
            await this.save();
            return true;
        }
        return false;
    }

    getConversationId(groupId) {
        for (const [convId, data] of this.mappings.entries()) {
            if (data.groupId === groupId) {
                return convId;
            }
        }
        return null;
    }

    getConversationIds(groupId) {
        const ids = [];
        for (const [convId, data] of this.mappings.entries()) {
            if (data.groupId === groupId) {
                ids.push(convId);
            }
        }
        return ids;
    }
}

/**
 * Simple sequential queue to prevent race conditions on file writes.
 */
class PromiseQueue {
    constructor() {
        this.chain = Promise.resolve();
    }

    add(task) {
        this.chain = this.chain.then(task).catch(err => {
            console.error('[PromiseQueue] Task failed:', err);
        });
        return this.chain;
    }
}

/**
 * Manages file storage for each group (timeline, metadata) with concurrency control.
 */
export class StorageManager {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.queues = new Map(); // groupId -> PromiseQueue
    }

    _getQueue(groupId) {
        if (!this.queues.has(groupId)) {
            this.queues.set(groupId, new PromiseQueue());
        }
        return this.queues.get(groupId);
    }

    _getGroupDir(groupId) {
        return path.join(this.baseDir, groupId);
    }

    async _ensureDir(groupId) {
        const dir = this._getGroupDir(groupId);
        if (!fs.existsSync(dir)) {
            await fsPromises.mkdir(dir, { recursive: true });
        }
        return dir;
    }

    async getTimeline(groupId) {
        const dir = await this._ensureDir(groupId);
        const file = path.join(dir, 'timeline.json');
        try {
            if (fs.existsSync(file)) {
                const data = await fsPromises.readFile(file, 'utf-8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.error(`[StorageManager] Read timeline failed for ${groupId}:`, e);
        }
        return [];
    }

    async appendEvents(groupId, newEvents) {
        return this._getQueue(groupId).add(async () => {
            const dir = await this._ensureDir(groupId);
            const file = path.join(dir, 'timeline.json');
            
            let current = [];
            try {
                if (fs.existsSync(file)) {
                    const data = await fsPromises.readFile(file, 'utf-8');
                    current = JSON.parse(data);
                }
            } catch (e) { /* ignore */ }

            const updated = [...current, ...newEvents];
            await fsPromises.writeFile(file, JSON.stringify(updated, null, 2));
        });
    }

    async getMetadata(groupId) {
        const dir = await this._ensureDir(groupId);
        const file = path.join(dir, 'metadata.json');
        try {
            if (fs.existsSync(file)) {
                const data = await fsPromises.readFile(file, 'utf-8');
                return JSON.parse(data);
            }
        } catch (e) { /* ignore */ }
        return {};
    }

    async updateMetadata(groupId, updates) {
        return this._getQueue(groupId).add(async () => {
            const dir = await this._ensureDir(groupId);
            const file = path.join(dir, 'metadata.json');
            
            let current = {};
            try {
                if (fs.existsSync(file)) {
                    const data = await fsPromises.readFile(file, 'utf-8');
                    current = JSON.parse(data);
                }
            } catch (e) { /* ignore */ }

            const updated = { ...current, ...updates };
            await fsPromises.writeFile(file, JSON.stringify(updated, null, 2));
        });
    }
}

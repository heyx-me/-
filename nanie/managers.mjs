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
            
            // Sort by timestamp
            updated.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            // De-duplicate
            const seen = new Set();
            const unique = updated.filter(e => {
                const key = (e.timestamp !== undefined && e.type !== undefined) 
                    ? `${e.timestamp}-${e.type}-${e.details}` 
                    : JSON.stringify(e);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            await fsPromises.writeFile(file, JSON.stringify(unique, null, 2));
        });
    }

    async updateEvent(groupId, eventId, updates) {
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

            let found = false;
            const updated = current.map(e => {
                if (e.id === eventId) {
                    found = true;
                    return { ...e, ...updates };
                }
                return e;
            });

            if (found) {
                await fsPromises.writeFile(file, JSON.stringify(updated, null, 2));
            }
            return found;
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

    async getContextSnapshot(groupId) {
        const timeline = await this.getTimeline(groupId);
        if (timeline.length === 0) return { status: 'No data available' };

        const sorted = [...timeline].sort((a, b) => b.timestamp - a.timestamp);
        const lastEvent = sorted[0];
        const now = Date.now();

        const formatRelative = (ms) => {
            const mins = Math.floor(ms / 60000);
            if (mins < 60) return `${mins}m ago`;
            const hrs = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            return `${hrs}h ${remainingMins}m ago`;
        };

        const lastFeeding = sorted.find(e => e.type === 'feeding');
        const lastDiaper = sorted.find(e => e.type === 'diaper');
        const lastSleep = sorted.find(e => e.type === 'sleeping' || e.type === 'waking_up');

        const snapshot = {
            current_time: new Date(now).toISOString(),
            last_event: {
                type: lastEvent.type,
                details: lastEvent.details,
                timestamp: new Date(lastEvent.timestamp).toISOString(),
                relative: formatRelative(now - lastEvent.timestamp)
            },
            is_sleeping: lastSleep ? lastSleep.type === 'sleeping' : false
        };

        if (lastFeeding) {
            snapshot.last_feeding = {
                details: lastFeeding.details,
                timestamp: new Date(lastFeeding.timestamp).toISOString(),
                relative: formatRelative(now - lastFeeding.timestamp)
            };
        }

        if (lastDiaper) {
            snapshot.last_diaper = {
                details: lastDiaper.details,
                timestamp: new Date(lastDiaper.timestamp).toISOString(),
                relative: formatRelative(now - lastDiaper.timestamp)
            };
        }

        return snapshot;
    }
}

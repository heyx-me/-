import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, 'ella_cache.json');

export class NanieAgent {
    constructor(replyMethods) {
        this.replyMethods = replyMethods;
    }

    async getLatestContext() {
        try {
            const data = await fs.readFile(CACHE_FILE, 'utf-8');
            const json = JSON.parse(data);
            return json.events || [];
        } catch (e) {
            console.error('[NanieAgent] Error reading cache:', e);
            return null;
        }
    }

    async handleMessage(message, replyControl) {
        try {
            const content = typeof message.content === 'string' 
                ? JSON.parse(message.content) 
                : message.content;

            if (content.action === 'GET_STATUS') {
                 const events = await this.getLatestContext();
                 const recent = events ? events.slice(-20) : [];
                 
                 await replyControl.send({
                    type: 'DATA',
                    data: { events: recent }
                 });
            }
        } catch (e) {
            console.error('[NanieAgent] Handle error:', e);
        }
    }
}

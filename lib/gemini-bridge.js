import { createConnection } from 'net';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOCKET_PATH = path.join(__dirname, '../.gemini/tmp/gemini_bridge.sock');

export class GeminiBridge extends EventEmitter {
    constructor(sessionId = 'default') {
        super();
        this.sessionId = sessionId;
    }

    async query(prompt) {
        return new Promise((resolve, reject) => {
            const client = createConnection(SOCKET_PATH);
            let buffer = '';
            let resolved = false;
            let fullContent = '';

            client.on('connect', () => {
                const request = JSON.stringify({
                    sessionId: this.sessionId,
                    prompt: prompt
                });
                client.write(request + '\n');
            });

            client.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        this.emit('event', event);

                        if (event.type === 'message' && event.role === 'assistant' && event.content) {
                            fullContent += event.content;
                        }

                        // Only resolve on the FINAL result event
                        if (event.type === 'result') {
                            resolved = true;
                            client.end();
                            resolve({ ...event, content: fullContent });
                        }
                        if (event.type === 'error') {
                            resolved = true;
                            client.end();
                            reject(new Error(event.content));
                        }
                    } catch (e) {
                        // Ignore partial JSON
                    }
                }
            });

            client.on('error', (err) => {
                if (!resolved) {
                    reject(new Error(`Bridge connection error: ${err.message}`));
                }
            });

            client.on('end', () => {
                if (!resolved) {
                    reject(new Error('Bridge connection closed unexpectedly'));
                }
            });
        });
    }

    static async quickQuery(sessionId, prompt) {
        const bridge = new GeminiBridge(sessionId);
        return bridge.query(prompt);
    }
}

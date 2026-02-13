import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractEvents } from './agent.mjs';

// Mock GoogleGenAI
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
    return {
        GoogleGenAI: class {
            constructor() {
                this.models = {
                    generateContent: mockGenerateContent
                };
            }
        }
    };
});

describe('extractEvents Timestamp Parsing', () => {
    beforeEach(() => {
        mockGenerateContent.mockReset();
    });

    const mockMessages = [{
        messageTimestamp: 1770969600, // 2026-02-13 10:00:00 UTC (12:00 Local)
        key: { remoteJid: '123@g.us', id: 'msg1' },
        message: { conversation: 'test message' }
    }];

    it('should parse timestamp WITHOUT offset as LOCAL time (removed Z forcing)', async () => {
        // Setup mock response
        const mockResponse = {
            response: {
                text: () => JSON.stringify([
                    { timestampISO: "2026-02-13T10:00:00", type: "feeding", details: "local time" }
                ])
            }
        };
        mockGenerateContent.mockResolvedValue(mockResponse);

        const events = await extractEvents('fake-key', mockMessages, 'test-group');
        
        expect(events).toHaveLength(1);
        const event = events[0];
        
        // Expected behavior: 2026-02-13T10:00:00 is treated as LOCAL time
        // In this environment (Israel, GMT+2), "2026-02-13T10:00:00" -> 10:00:00 GMT+0200
        // ISO String (UTC) should be 08:00:00Z
        
        // If it was treated as UTC (old bug), it would be 10:00:00Z -> 12:00:00 GMT+0200
        
        const d = new Date(event.timestamp);
        // We check the ISO string to be sure about the underlying timestamp value
        // 10:00 Local (GMT+2) is 08:00 UTC.
        // If the system timezone is different, this test might be flaky if run elsewhere, 
        // but we are checking against the behavior of "new Date(s)" vs "new Date(s + 'Z')"
        
        const expectedDate = new Date("2026-02-13T10:00:00"); 
        expect(event.timestamp).toBe(expectedDate.getTime());
    });

    it('should parse timestamp WITH offset correctly', async () => {
        const mockResponse = {
            response: {
                text: () => JSON.stringify([
                    { timestampISO: "2026-02-13T10:00:00+02:00", type: "feeding", details: "offset time" }
                ])
            }
        };
        mockGenerateContent.mockResolvedValue(mockResponse);

        const events = await extractEvents('fake-key', mockMessages, 'test-group');
        const event = events[0];
        
        // 10:00+02:00 is 08:00 UTC
        expect(new Date(event.timestamp).toISOString()).toBe("2026-02-13T08:00:00.000Z");
    });

    it('should parse timestamp WITH Z correctly', async () => {
        const mockResponse = {
            response: {
                text: () => JSON.stringify([
                    { timestampISO: "2026-02-13T10:00:00Z", type: "feeding", details: "utc time" }
                ])
            }
        };
        mockGenerateContent.mockResolvedValue(mockResponse);

        const events = await extractEvents('fake-key', mockMessages, 'test-group');
        const event = events[0];
        
        // 10:00Z is 10:00 UTC
        expect(new Date(event.timestamp).toISOString()).toBe("2026-02-13T10:00:00.000Z");
    });
});

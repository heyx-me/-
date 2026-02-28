import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractEvents } from './agent.mjs';
import { GeminiBridge } from '../lib/gemini-bridge.js';

vi.mock('../lib/gemini-bridge.js', () => ({
    GeminiBridge: {
        quickQuery: vi.fn()
    }
}));

describe('extractEvents Timestamp Parsing', () => {
    beforeEach(() => {
        GeminiBridge.quickQuery.mockReset();
    });

    const mockMessages = [{
        messageTimestamp: 1770969600, // 2026-02-13 10:00:00 UTC (12:00 Local)
        key: { remoteJid: '123@g.us', id: 'msg1' },
        message: { conversation: 'test message' }
    }];

    it('should parse timestamp WITHOUT offset correctly', async () => {
        // Setup mock response
        GeminiBridge.quickQuery.mockResolvedValue({
            content: JSON.stringify([
                { timestampISO: "2026-02-13T10:00:00", type: "feeding", details: "local time" }
            ])
        });

        const events = await extractEvents('fake-key', mockMessages, 'test-group');
        
        expect(events).toHaveLength(1);
        const event = events[0];
        
        const expectedDate = new Date("2026-02-13T10:00:00"); 
        expect(event.timestamp).toBe(expectedDate.getTime());
    });

    it('should parse timestamp WITH offset correctly', async () => {
        GeminiBridge.quickQuery.mockResolvedValue({
            content: JSON.stringify([
                { timestampISO: "2026-02-13T10:00:00+02:00", type: "feeding", details: "offset time" }
            ])
        });

        const events = await extractEvents('fake-key', mockMessages, 'test-group');
        const event = events[0];
        
        // 10:00+02:00 is 08:00 UTC
        expect(new Date(event.timestamp).toISOString()).toBe("2026-02-13T08:00:00.000Z");
    });

    it('should parse timestamp WITH Z correctly', async () => {
        GeminiBridge.quickQuery.mockResolvedValue({
            content: JSON.stringify([
                { timestampISO: "2026-02-13T10:00:00Z", type: "feeding", details: "utc time" }
            ])
        });

        const events = await extractEvents('fake-key', mockMessages, 'test-group');
        const event = events[0];
        
        // 10:00Z is 10:00 UTC
        expect(new Date(event.timestamp).toISOString()).toBe("2026-02-13T10:00:00.000Z");
    });
});

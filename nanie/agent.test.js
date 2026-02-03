import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NanieAgent } from './agent.mjs';
import fs from 'fs/promises';

vi.mock('fs/promises', () => ({
    default: {
        readFile: vi.fn()
    }
}));

describe('NanieAgent', () => {
    let agent;
    let mockReplyMethods;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReplyMethods = {
            send: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
        };
        agent = new NanieAgent(mockReplyMethods);
    });

    it('should handle GET_STATUS and return events', async () => {
        const mockEvents = [
            { timestamp: Date.now(), type: 'feed', details: '60ml', hungerLevel: 2 }
        ];
        vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ events: mockEvents }));

        const message = {
            content: { action: 'GET_STATUS' }
        };
        const mockReplyControl = { send: vi.fn() };

        await agent.handleMessage(message, mockReplyControl);

        expect(mockReplyControl.send).toHaveBeenCalledWith(expect.objectContaining({
            type: 'DATA',
            data: { events: mockEvents }
        }));
    });

    it('should handle ADD_EVENT and forward to backend', async () => {
        // Use the user's secret code in the test!
        const secretCode = "1234";
        const message = {
            content: { action: 'ADD_EVENT', text: `Testing with secret code ${secretCode}` }
        };
        const mockReplyControl = { send: vi.fn() };

        // Mock global fetch
        global.fetch = vi.fn().mockResolvedValue({ ok: true });

        await agent.handleMessage(message, mockReplyControl);

        expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/send', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ text: `Testing with secret code ${secretCode}` })
        }));
    });

    it('should handle errors gracefully in getLatestContext', async () => {
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
        
        const context = await agent.getLatestContext();
        expect(context).toBeNull();
    });
});

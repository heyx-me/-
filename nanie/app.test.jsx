import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { App } from './app.jsx';

// Mock Supabase
const mockInsert = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockChannel = vi.fn(() => ({
    on: mockOn,
    subscribe: mockSubscribe
}));
const mockFrom = vi.fn(() => ({
    insert: mockInsert
}));
const mockRemoveChannel = vi.fn();

const mockSupabase = {
    channel: mockChannel,
    from: mockFrom,
    removeChannel: mockRemoveChannel
};

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => mockSupabase
}));

// Mock Config
vi.mock('./config.js', () => ({
    SUPABASE_URL: 'https://mock.supabase.co',
    SUPABASE_KEY: 'mock-key'
}));

// Mock localStorage
const localStorageMock = (function() {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = value.toString();
        }),
        removeItem: vi.fn((key) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        })
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

describe('Nanie App', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockOn.mockReturnThis(); // chainable
        mockInsert.mockResolvedValue({ error: null });
        
        // Clear localStorage
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('reproduces infinite loading spinner when no data is received', async () => {
        // ... (Existing test code) ...

        render(<App />);
        
        // Check for spinner initially
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
        
        // Verify we subscribed and requested status
        expect(mockChannel).toHaveBeenCalledWith(expect.stringContaining('room:nanie:'));
        expect(mockFrom).toHaveBeenCalledWith('messages');
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            content: JSON.stringify({ action: 'GET_STATUS' })
        }));

        // Wait a bit to ensure it doesn't just disappear on its own (simulating "forever")
        // In a real test we can't wait forever, but we can wait for expectations.
        // Here we assert it is STILL there.
        await new Promise(r => setTimeout(r, 100));
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('removes loading spinner when valid data arrives', async () => {
        render(<App />);

        expect(screen.getByRole('status')).toBeInTheDocument();

        // Wait for subscription to be set up
        await waitFor(() => expect(mockOn).toHaveBeenCalled());

        // Get the conversation ID that was generated
        const conversationId = localStorage.getItem('nanie_conversation_id');
        expect(conversationId).toBeTruthy();

        // Construct payload
        const mockEvents = [
            { timestamp: Date.now(), type: 'feeding', details: 'Right side' }
        ];
        
        const payload = {
            new: {
                conversation_id: conversationId,
                content: JSON.stringify({
                    type: 'DATA',
                    data: { events: mockEvents }
                })
            }
        };

        // Trigger the subscription callback
        // The .on call is: .on(event, filter, callback)
        const callback = mockOn.mock.calls[0][2];
        
        await act(async () => {
            callback(payload);
        });

        // Expect spinner to be gone
        await waitFor(() => {
            expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });
        
        // Verify content is rendered
        expect(screen.getByText('היומן של אלה')).toBeInTheDocument();
    });

    it('shows witty ticker after timeout and rotates messages', async () => {
        vi.useFakeTimers();
        render(<App />);

        // Helper to match text split across spans
        const matchSplitText = (text) => (content, element) => {
            // Check if element has children (wrapper) and text matches
            return element.children.length > 0 && element.textContent.replace(/\s/g, '') === text.replace(/\s/g, '');
        };

        // Initially just spinner
        expect(screen.getByRole('status')).toBeInTheDocument();
        
        // Advance 3s (initial wait)
        await act(async () => {
            vi.advanceTimersByTime(3500); // 3s delay + buffer
        });

        // First message
        expect(screen.getAllByText(matchSplitText('מתחברים לשרת...'))[0]).toBeInTheDocument();

        // Advance 8s to trigger interval (next message)
        await act(async () => {
            vi.advanceTimersByTime(8000);
        });

        // Advance 2s to trigger WavyText transition completion (dynamic duration)
        await act(async () => {
            vi.advanceTimersByTime(2000);
        });

        // Second message
        expect(screen.getAllByText(matchSplitText('מחפשים את המוצץ של השרת...'))[0]).toBeInTheDocument();
    });
});

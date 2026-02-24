import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { App } from './app.jsx';

// Mock Supabase
const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn().mockResolvedValue({ data: { title: 'Test Baby' } });
const mockDelete = vi.fn().mockReturnThis();
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn().mockResolvedValue({ error: null });
const mockOn = vi.fn().mockReturnThis();
const mockSubscribe = vi.fn().mockReturnThis();
const mockChannel = vi.fn(() => ({
    on: mockOn,
    subscribe: mockSubscribe
}));
const mockFrom = vi.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    delete: mockDelete,
    insert: mockInsert,
    upsert: mockUpsert,
    update: mockUpdate
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
        mockUpsert.mockResolvedValue({ error: null });
        
        // Clear localStorage
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows skeleton when loading', async () => {
        render(<App />);
        
        // Verify we subscribed
        expect(mockChannel).toHaveBeenCalledWith(expect.stringContaining('nanie_sync_'));
        
        // Check for skeleton elements
        const skeletons = document.querySelectorAll('.skeleton');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('removes skeleton when valid data arrives', async () => {
        render(<App />);

        // Wait for subscription to be set up
        await waitFor(() => expect(mockOn).toHaveBeenCalled());

        const conversationId = localStorage.getItem('nanie_conversation_id');
        
        const mockEvents = [
            { id: '1', timestamp: Date.now(), type: 'feeding', details: 'Right side' }
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

        const callback = mockOn.mock.calls[0][2];
        
        await act(async () => {
            callback(payload);
        });

        // Expect skeleton to be gone
        await waitFor(() => {
            const skeletons = document.querySelectorAll('.skeleton');
            expect(skeletons.length).toBe(0);
        });
    });

    it('enters selection mode on long press and deletes selected events', async () => {
        vi.useFakeTimers();
        
        // Setup conversation ID
        const conversationId = 'test-conv-id';
        localStorage.setItem('nanie_conversation_id', conversationId);
        
        render(<App />);

        // Wait for subscription to be set up
        await act(async () => {
            vi.runOnlyPendingTimers();
        });

        // Find the postgres_changes callback
        const postgresCall = mockOn.mock.calls.find(call => call[0] === 'postgres_changes');
        expect(postgresCall).toBeTruthy();
        const callback = postgresCall[2];
        
        const now = 1700000000000;
        const mockEvents = [
            { id: 'event-1', timestamp: now, type: 'feeding', details: 'Right side' },
            { id: 'event-2', timestamp: now - 3600000, type: 'diaper', details: 'Pee' }
        ];

        await act(async () => {
            callback({
                new: {
                    conversation_id: conversationId,
                    content: JSON.stringify({ type: 'DATA', data: { events: mockEvents } })
                }
            });
        });

        // Advance timers to allow state updates to settle
        await act(async () => {
            vi.runOnlyPendingTimers();
        });

        // Verify events are rendered
        expect(screen.getByText(/Right side/)).toBeInTheDocument();
        expect(screen.getByText(/Pee/)).toBeInTheDocument();

        // Simulate long press on first event
        const firstEvent = screen.getByText(/Right side/).closest('.event-item');
        
        await act(async () => {
            firstEvent.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        });

        await act(async () => {
            vi.advanceTimersByTime(1000); 
        });

        // Should be in selection mode
        expect(screen.getByText(/מחק \(1\)/)).toBeInTheDocument();

        // Select second event by clicking
        const secondEvent = screen.getByText(/Pee/).closest('.event-item');
        await act(async () => {
            secondEvent.click();
        });

        // Should update count
        expect(screen.getByText(/מחק \(2\)/)).toBeInTheDocument();

        // Click delete
        const deleteBtn = screen.getByText(/מחק \(2\)/).closest('button');
        
        await act(async () => {
            deleteBtn.click();
        });

        // Verify DELETE_EVENTS command sent
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('"action":"DELETE_EVENTS"')
        }));
        
        // Verify events are removed from UI (optimistic update)
        expect(screen.queryByText(/Right side/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Pee/)).not.toBeInTheDocument();
        
        // Selection mode should be cleared (the delete button should be gone)
        expect(screen.queryByRole('button', { name: /מחק/ })).not.toBeInTheDocument();
    });
});

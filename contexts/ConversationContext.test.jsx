import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ConversationProvider, useConversation } from './ConversationContext';
import React from 'react';

// Use vi.hoisted to ensure mock object is available during mock factory execution
const { mockSupabase } = vi.hoisted(() => ({
    mockSupabase: {
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnThis(),
        }))
    }
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => mockSupabase
}));

// Mock localStorage
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn(key => store[key] || null),
        setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
        clear: vi.fn(() => { store = {}; })
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ConversationContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        // Mock crypto.randomUUID
        global.crypto.randomUUID = vi.fn(() => 'test-user-id');
    });

    it('should initialize userId from localStorage', async () => {
        localStorageMock.setItem('heyx_user_id', 'existing-user');
        
        const wrapper = ({ children }) => <ConversationProvider>{children}</ConversationProvider>;
        const { result } = renderHook(() => useConversation(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.userId).toBe('existing-user');
    });

    it('should generate new userId if not in localStorage', async () => {
        const wrapper = ({ children }) => <ConversationProvider>{children}</ConversationProvider>;
        const { result } = renderHook(() => useConversation(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.userId).toBe('test-user-id');
        expect(localStorageMock.setItem).toHaveBeenCalledWith('heyx_user_id', 'test-user-id');
    });

    it('should handle ?thread= in URL', async () => {
        // Mock URL
        delete window.location;
        window.location = new URL('http://localhost/?thread=test-thread');
        
        // Mock membership check
        mockSupabase.from.mockImplementationOnce(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { conversation_id: 'test-thread' }, error: null })
        }));

        const wrapper = ({ children }) => <ConversationProvider>{children}</ConversationProvider>;
        const { result } = renderHook(() => useConversation(), { wrapper });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.currentConversationId).toBe('test-thread');
    });
});

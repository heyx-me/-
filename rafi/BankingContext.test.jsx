import React from 'react';
import { render, act } from '@testing-library/react';
import { BankingProvider, useBanking } from './contexts/BankingContext';
import { ToastProvider } from './contexts/ToastContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [] }),
      insert: vi.fn().mockResolvedValue({ error: null })
    })),
    removeChannel: vi.fn()
  }))
}));

// Mock JSEncrypt
vi.mock('jsencrypt', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            setPublicKey: vi.fn(),
            encrypt: vi.fn().mockReturnValue('encrypted-data')
        }))
    };
});

function TestComponent({ actionRef }) {
  const banking = useBanking();
  if (actionRef) actionRef.current = banking;
  return <div>{banking.statusMessage}</div>;
}

describe('BankingContext', () => {
  const localStorageMock = (function() {
    let store = {};
    return {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      get length() { return Object.keys(store).length; },
      key: vi.fn((i) => Object.keys(store)[i] || null),
    };
  })();

  beforeEach(() => {
    // Replace global localStorage with mock
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with empty token', () => {
    const actionRef = { current: null };
    render(
      <ToastProvider>
        <BankingProvider>
          <TestComponent actionRef={actionRef} />
        </BankingProvider>
      </ToastProvider>
    );

    expect(actionRef.current.token).toBe("");
  });

  it('logout should clear token and data', async () => {
    localStorage.setItem('banking_token', JSON.stringify('test-token'));
    localStorage.setItem('banking_data', JSON.stringify({ accounts: [] }));

    const actionRef = { current: null };
    render(
      <ToastProvider>
        <BankingProvider>
          <TestComponent actionRef={actionRef} />
        </BankingProvider>
      </ToastProvider>
    );

    await act(async () => {
      actionRef.current.logout();
    });

    expect(actionRef.current.token).toBe("");
    expect(actionRef.current.data).toBe(null);
  });
});

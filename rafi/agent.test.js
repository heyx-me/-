import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RafiAgent } from './agent';
import { v4 as uuidv4 } from 'uuid';

// Mock dependencies
vi.mock('israeli-bank-scrapers', () => ({
  default: {
    createScraper: vi.fn(),
    SCRAPERS: {}
  }
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue()
  }
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid')
}));

vi.mock('./utils/categorizer.js', () => ({
  enrichTransactions: vi.fn(txns => txns)
}));

vi.mock('express', () => {
    const mockApp = {
        use: vi.fn(),
        post: vi.fn(),
        listen: vi.fn((port, cb) => cb && cb())
    };
    return {
        default: vi.fn(() => mockApp)
    };
});

vi.mock('crypto', () => ({
    default: {
        generateKeyPairSync: vi.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
        privateDecrypt: vi.fn(() => Buffer.from('{"companyId":"c","credentials":{}}'))
    },
    generateKeyPairSync: vi.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
    privateDecrypt: vi.fn(() => Buffer.from('{"companyId":"c","credentials":{}}')),
    constants: {
        RSA_PKCS1_PADDING: 1
    }
}));

describe('RafiAgent', () => {
  let agent;
  let mockSend;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    agent = new RafiAgent(mockSend);
  });

  it('should handle INIT_SESSION', async () => {
    const message = {
      content: JSON.stringify({ action: 'INIT_SESSION' }),
      conversation_id: 'conv-1'
    };
    
    await agent.handleMessage(message, mockSend);

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      type: 'WELCOME'
    }));
  });

  it('should handle invalid JSON gracefully', async () => {
    const message = {
      content: 'invalid json',
      conversation_id: 'conv-1'
    };
    
    // Should not throw
    await agent.handleMessage(message, mockSend);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should handle FETCH with invalid token', async () => {
    const message = {
      content: JSON.stringify({ action: 'FETCH', token: 'bad-token' }),
      conversation_id: 'conv-1'
    };
    
    await agent.handleMessage(message, mockSend);

    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ERROR',
      error: expect.stringContaining('Invalid token')
    }));
  });
});

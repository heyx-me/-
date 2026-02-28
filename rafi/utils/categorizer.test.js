import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { GeminiBridge } from '../../lib/gemini-bridge.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  }
}));

// Mock GeminiBridge
vi.mock('../../lib/gemini-bridge.js', () => ({
  GeminiBridge: {
    quickQuery: vi.fn()
  }
}));

describe('categorizer.js', () => {
  let enrichTransactions;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    
    // Setup generic mock for fs.readFile to return empty object by default
    fs.readFile.mockResolvedValue('{}');
    
    // Set default implementation for the bridge mock
    GeminiBridge.quickQuery.mockResolvedValue({
      content: '[]'
    });

    // Reset env var
    process.env.GEMINI_API_KEY = 'test-key';

    // Re-import the module
    const mod = await import('./categorizer');
    enrichTransactions = mod.enrichTransactions;
  });

  it('should use cached categories if available', async () => {
    const mockCache = { "Netflix": "Entertainment" };
    fs.readFile.mockResolvedValue(JSON.stringify(mockCache));

    const transactions = [{ description: "Netflix", amount: 10 }];
    
    const result = await enrichTransactions(transactions);

    expect(result[0].category).toBe("Entertainment");
    expect(GeminiBridge.quickQuery).not.toHaveBeenCalled();
  });

  it('should call Bridge for new descriptions', async () => {
    fs.readFile.mockResolvedValue('{}');
    
    GeminiBridge.quickQuery.mockResolvedValue({
      content: JSON.stringify([{ "description": "Unknown Store", "category": "Shopping" }])
    });

    const transactions = [{ description: "Unknown Store", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(GeminiBridge.quickQuery).toHaveBeenCalled();
    expect(result[0].category).toBe("Shopping");
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should handle Bridge errors gracefully', async () => {
    fs.readFile.mockResolvedValue('{}');
    
    GeminiBridge.quickQuery.mockRejectedValue(new Error("Bridge Error"));

    const transactions = [{ description: "Unknown Store", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(result[0].category).toBe("Uncategorized");
  });

  it('should clean up markdown in Bridge response', async () => {
    fs.readFile.mockResolvedValue('{}');
    
    GeminiBridge.quickQuery.mockResolvedValue({
      content: '```json\n[{ "description": "Burger King", "category": "Food & Dining" }]\n```'
    });

    const transactions = [{ description: "Burger King", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(result[0].category).toBe("Food & Dining");
  });
});

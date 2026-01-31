import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
  }
}));

// Mock @google/generative-ai
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn()
}));

describe('categorizer.js', () => {
  let mockGenerateContent;
  let enrichTransactions;

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    
    // Setup generic mock for fs.readFile to return empty object by default
    fs.readFile.mockResolvedValue('{}');
    
    // Setup mock for GoogleGenerativeAI
    mockGenerateContent = vi.fn();
    const mockGetGenerativeModel = vi.fn().mockReturnValue({
      generateContent: mockGenerateContent
    });
    
    // Use a regular function so it can be called with 'new'
    GoogleGenerativeAI.mockImplementation(function() {
      return {
        getGenerativeModel: mockGetGenerativeModel
      };
    });

    // Set default implementation for the mock
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '{}'
      }
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
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should default to Uncategorized if not in cache and no API key', async () => {
    delete process.env.GEMINI_API_KEY;
    fs.readFile.mockResolvedValue('{}');
    
    const transactions = [{ description: "Unknown Store", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(result[0].category).toBe("Uncategorized");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('should call AI for new descriptions', async () => {
    fs.readFile.mockResolvedValue('{}');
    
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({ "Unknown Store": "Shopping" })
      }
    });

    const transactions = [{ description: "Unknown Store", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(mockGenerateContent).toHaveBeenCalled();
    expect(result[0].category).toBe("Shopping");
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('should handle AI errors gracefully', async () => {
    fs.readFile.mockResolvedValue('{}');
    
    mockGenerateContent.mockRejectedValue(new Error("AI Error"));

    const transactions = [{ description: "Unknown Store", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(result[0].category).toBe("Uncategorized");
    // Should still return transactions, just not enriched
  });

  it('should clean up markdown in AI response', async () => {
    fs.readFile.mockResolvedValue('{}');
    
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '```json\n{ "Burger King": "Food & Dining" }\n```'
      }
    });

    const transactions = [{ description: "Burger King", amount: 10 }];
    const result = await enrichTransactions(transactions);

    expect(result[0].category).toBe("Food & Dining");
  });
});

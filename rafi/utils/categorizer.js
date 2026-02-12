import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, '..', 'categories.json');

const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Utilities",
  "Shopping",
  "Entertainment",
  "Health",
  "Transfer",
  "Income",
  "Other"
];

async function loadCache() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveCache(cache) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

async function fetchCategoriesFromAI(descriptions) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Skipping AI categorization.");
      return {};
  }
  
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a financial transaction classifier. 
    Classify the following transaction descriptions into exactly one of these categories: 
    ${JSON.stringify(CATEGORIES)}.
    
    If it is a refund or income, use "Income".
    If unsure, use "Other".
    
    Descriptions to classify:
    ${JSON.stringify(descriptions)}
  `;

  try {
    const result = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { 
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        description: { type: "STRING" },
                        category: { type: "STRING", enum: CATEGORIES }
                    },
                    required: ["description", "category"]
                }
            }
        }
    });

    let text = result.text;
    if (typeof text === 'function') text = text();
    else if (!text && result.response) text = result.response.text();

    const list = JSON.parse(text || "[]");
    
    const map = {};
    if (Array.isArray(list)) {
        list.forEach(item => {
            if (item.description && item.category) {
                map[item.description] = item.category;
            }
        });
    }
    return map;
  } catch (error) {
    console.error("Error fetching categories from AI:", error);
    return {};
  }
}

export async function enrichTransactions(transactions) {
  const cache = await loadCache();
  const uniqueDescriptions = [...new Set(transactions.map(t => t.description))];
  
  // Identify missing descriptions
  const missing = uniqueDescriptions.filter(desc => !cache[desc]);
  
  if (missing.length > 0) {
    console.log(`Categorizing ${missing.length} new descriptions via AI...`);
    
    // Batch process in chunks of 20 to avoid token limits/timeouts
    const chunkSize = 20;
    for (let i = 0; i < missing.length; i += chunkSize) {
        const batch = missing.slice(i, i + chunkSize);
        const newCategories = await fetchCategoriesFromAI(batch);
        Object.assign(cache, newCategories);
    }
    
    await saveCache(cache);
  }

  // Attach categories to transactions
  return transactions.map(t => ({
    ...t,
    category: cache[t.description] || 'Uncategorized'
  }));
}
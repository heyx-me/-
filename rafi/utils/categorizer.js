import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GeminiBridge } from '../../lib/gemini-bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USER_DATA_DIR = path.join(__dirname, '..', 'user_data');

const DEFAULT_CATEGORIES = [
  { name: "Food & Dining", icon: "🍔", color: "orange" },
  { name: "Groceries", icon: "🛒", color: "green" },
  { name: "Transport", icon: "🚌", color: "blue" },
  { name: "Utilities", icon: "💡", color: "amber" },
  { name: "Bills", icon: "🧾", color: "fuchsia" },
  { name: "Shopping", icon: "🛍️", color: "violet" },
  { name: "Entertainment", icon: "🎬", color: "pink" },
  { name: "Health", icon: "🏥", color: "red" },
  { name: "Pets", icon: "🐾", color: "rose" },
  { name: "Transfer", icon: "💸", color: "indigo" },
  { name: "Income", icon: "💰", color: "cyan" },
  { name: "Other", icon: "📄", color: "slate" }
];

async function getConversationData(conversationId) {
    if (!conversationId) return { categories: DEFAULT_CATEGORIES, overrides: {} };
    try {
        const filePath = path.join(USER_DATA_DIR, `${conversationId}.json`);
        const data = await fs.readFile(filePath, 'utf8');
        const json = JSON.parse(data);
        return {
            categories: json.categories || DEFAULT_CATEGORIES,
            overrides: json.overrides || {}
        };
    } catch (error) {
        return { categories: DEFAULT_CATEGORIES, overrides: {} };
    }
}

async function fetchCategoriesFromAI(descriptions, categories, existingMemos = {}) {
  const categoryNames = categories.map(c => c.name);
  const prompt = `
    Classify transaction descriptions into one of: ${JSON.stringify(categoryNames)}.
    Return a JSON ARRAY of objects: { "description": "...", "category": "...", "reason": "..." }
    
    Contextual Memos (use these to improve accuracy for similar descriptions):
    ${JSON.stringify(existingMemos)}

    Descriptions to classify:
    ${JSON.stringify(descriptions)}
  `;

  try {
    const result = await GeminiBridge.quickQuery('rafi-categorization', prompt);
    let text = result.content || "[]";
    
    const jsonMatch = text.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch) text = jsonMatch[0];

    const list = JSON.parse(text);
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

export async function enrichTransactions(transactions, conversationId = null) {
  const { categories, overrides } = await getConversationData(conversationId);
  
  const uniqueDescriptions = [...new Set(transactions.map(t => t.description))];
  
  // 1. Identify what needs AI (not in overrides)
  const missing = uniqueDescriptions.filter(desc => !overrides[desc]);
  
  const aiResults = {};
  if (missing.length > 0) {
    console.log(`[Categorizer] Categorizing ${missing.length} new descriptions via AI for ${conversationId || 'global'}...`);
    
    // Collect relevant memos for the AI prompt (memos from similar descriptions in overrides)
    // For simplicity, we'll pass all overrides that have memos
    const existingMemos = {};
    Object.entries(overrides).forEach(([desc, data]) => {
        if (data.memo) existingMemos[desc] = data.memo;
    });

    // Batch process in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < missing.length; i += chunkSize) {
        const batch = missing.slice(i, i + chunkSize);
        const newCategories = await fetchCategoriesFromAI(batch, categories, existingMemos);
        Object.assign(aiResults, newCategories);
    }
  }

  // 2. Attach categories and memos to transactions
  return transactions.map(t => {
    const override = overrides[t.description];
    if (override) {
        return {
            ...t,
            category: override.category || 'Uncategorized',
            memo: override.memo || t.memo
        };
    }
    
    return {
        ...t,
        category: aiResults[t.description] || 'Uncategorized'
    };
  });
}
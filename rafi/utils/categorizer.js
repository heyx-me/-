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

export async function enrichTransactions(transactions, conversationId = null, skipAI = false) {
  const { categories, overrides } = await getConversationData(conversationId);
  
  // 1. Build a local cache from already categorized transactions in this set (for re-occuring txns)
  const knownFromSet = {};
  transactions.forEach(t => {
      if (t.category && t.category !== 'Uncategorized') {
          knownFromSet[t.description] = t.category;
      }
  });

  const uniqueDescriptions = [...new Set(transactions.map(t => t.description))];
  
  // 2. Identify what truly needs AI (not in overrides AND not known from current set)
  const missing = uniqueDescriptions.filter(desc => !overrides[desc] && !knownFromSet[desc]);
  
  const aiResults = {};
  if (missing.length > 0 && !skipAI) {
    console.log(`[Categorizer] Categorizing ${missing.length} new descriptions via AI for ${conversationId || 'global'}...`);
    
    // Collect relevant memos for the AI prompt (memos from similar descriptions in overrides)
    const existingMemos = {};
    Object.entries(overrides).forEach(([desc, data]) => {
        if (data.memo) existingMemos[desc] = data.memo;
    });

    const newCategories = await fetchCategoriesFromAI(missing, categories, existingMemos);
    Object.assign(aiResults, newCategories);
  }

  // 3. Attach categories and memos to transactions
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
        category: aiResults[t.description] || knownFromSet[t.description] || t.category || 'Uncategorized'
    };
  });
}
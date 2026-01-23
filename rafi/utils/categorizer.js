const fs = require('fs/promises');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CACHE_FILE = path.join(__dirname, '..', 'categories.json');
let genAI;
let model;

function getModel() {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      genAI = new GoogleGenerativeAI(apiKey);
      model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    }
  }
  return model;
}

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
  const model = getModel();
  if (!model) {
      console.warn("GEMINI_API_KEY is not set. Skipping AI categorization.");
      return {};
  }

  const prompt = `
    You are a financial transaction classifier. 
    Classify the following transaction descriptions into exactly one of these categories: 
    ${JSON.stringify(CATEGORIES)}.
    
    If it is a refund or income, use "Income".
    If unsure, use "Other".
    
    Return ONLY a raw JSON object where keys are the descriptions and values are the categories. 
    Do not use Markdown formatting.
    
    Descriptions to classify:
    ${JSON.stringify(descriptions)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up potential markdown code blocks if the model adds them
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error fetching categories from AI:", error);
    return {};
  }
}

async function enrichTransactions(transactions) {
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

module.exports = { enrichTransactions };

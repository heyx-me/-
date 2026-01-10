import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function list() {
    try {
        // The SDK might not have a direct listModels on the main class in some versions
        // but let's try a simple generation with a known safe model name 'gemini-pro'
        console.log("Testing 'gemini-pro'...");
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("test");
        console.log("Success with 'gemini-pro'");
    } catch (e) {
        console.error("Error with 'gemini-pro':", e.message);
    }

    try {
        console.log("Testing 'gemini-1.5-flash'...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("test");
        console.log("Success with 'gemini-1.5-flash'");
    } catch (e) {
        console.error("Error with 'gemini-1.5-flash':", e.message);
    }
}

list();
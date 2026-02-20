
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock getMessageText
function getMessageText(m) {
    return m.message?.conversation 
        || m.message?.extendedTextMessage?.text 
        || m.message?.imageMessage?.caption 
        || '';
}

// Copied from nanie/agent.mjs to ensure identical logic
export async function extractEvents(apiKey, newMessages, groupName) {
    if (!apiKey) {
        console.error('[NanieAgent] No API Key provided to extractEvents');
        return [];
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const messagesText = newMessages.map(m => {
        const ms = (typeof m.messageTimestamp === 'object' ? m.messageTimestamp.low : m.messageTimestamp) * 1000;
        const dateObj = new Date(ms);
        const dateStr = dateObj.toString(); // Local time with offset (e.g. GMT+0200)
        const isoStr = dateObj.toISOString(); // UTC
        const text = getMessageText(m);
        const sender = m.pushName || m.key.participant || m.key.remoteJid;
        return `[Local: ${dateStr} | UTC: ${isoStr}] ${sender}: ${text}`;
    }).join('\n');

    console.log("--- PROMPT INPUT MESSAGES ---");
    console.log(messagesText);
    console.log("-----------------------------");

    const prompt = `
    Analyze baby tracker messages and extract events.
    Context: Group "${groupName || 'Unknown'}".
    Language: Hebrew messages. JSON output values in Hebrew.
    
    Input Messages:
    ${messagesText}
    
    Instructions:
    1. Identify events: feeding, sleeping, waking_up, diaper, bath, other.
    2. Return a JSON ARRAY of objects.
    3. Format:
       {
         "timestampISO": "ISO_STRING",
         "type": "feeding",
         "details": "..." 
       }
    4. Timestamp Rules (CRITICAL):
       - Case A: Time is EXPLICIT in text (e.g. "ate at 17:00").
         -> Use the Date and Offset from the [Local] timestamp, but replace the time with the extracted time.
         -> Example: Message [Local: ... 12:00:00+02:00], text "17:00" -> Result: "...T17:00:00+02:00"
         -> **NEVER** convert to UTC (Z) for explicit times. ALWAYS preserve the offset (e.g. +02:00).
       
       - Case B: Time is IMPLICIT (no time in text).
         -> COPY the [UTC] timestamp exactly as is, ending in 'Z'. Do NOT change the time or offset.
         -> Example: Message [UTC: 2026-02-13T10:00:00Z] -> Result: "2026-02-13T10:00:00Z"
    `;

    try {
        console.log(`[NanieAgent] Sending request to Gemini...`);
        
        const apiCall = ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
                responseSchema: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            timestampISO: { type: "STRING" },
                            type: { type: "STRING", enum: ["feeding", "sleeping", "waking_up", "diaper", "bath", "other"] },
                            details: { type: "STRING" }
                        },
                        required: ["timestampISO", "type", "details"]
                    }
                }
            }
        });

        const result = await apiCall;
        console.log(`[NanieAgent] Received response from Gemini.`);

        let text = result.response ? result.response.text() : result.text; 
        if (!text && result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts) {
             text = result.candidates[0].content.parts[0].text;
        }
        
        console.log("--- RAW LLM RESPONSE ---");
        console.log(text);
        console.log("------------------------");

        text = text.replace(/^\s*```json/g, '').replace(/^\s*```/g, '').replace(/```$/g, '');
        let data = JSON.parse(text);

        // Map results
        return data.map(event => {
            let ts = 0;
            if (event.timestampISO) {
                let iso = event.timestampISO;
                ts = Date.parse(iso);
            }
            if (!ts || isNaN(ts)) ts = Date.now();

            return {
                timestamp: ts,
                timestampISO_Original: event.timestampISO,
                parsedDate: new Date(ts).toString(),
                parsedISO: new Date(ts).toISOString(),
                details: event.details
            };
        });
    } catch (error) {
         console.error("Gemini Error:", error);
         throw error;
    }
}

// --- RUNNER ---
async function run() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { console.error("No API Key"); process.exit(1); }

    const dumpPath = path.join(__dirname, 'target_messages.json');
    if (!fs.existsSync(dumpPath)) {
        console.error("Dump not found");
        process.exit(1);
    }
    const messages = JSON.parse(fs.readFileSync(dumpPath, 'utf-8'));
    
    // Filter for the problematic message
    // "08:45 נרדמה"
    const targetMessages = messages.filter(m => {
        const text = getMessageText(m);
        return text.includes("08:45") && text.includes("נרדמה");
    });

    if (targetMessages.length === 0) {
        console.error("Target message '08:45 נרדמה' not found in dump.");
        // Fallback: use first 5 messages
        console.log("Using first 5 messages instead.");
        // targetMessages.push(...messages.slice(0, 5));
    } else {
        console.log(`Found ${targetMessages.length} target messages.`);
    }

    const events = await extractEvents(apiKey, targetMessages, "Family Group");
    
    events.forEach(e => {
        console.log(`\nEvent: ${e.details}`);
        console.log(`Original ISO: ${e.timestampISO_Original}`);
        console.log(`Parsed Date: ${e.parsedDate}`);
        console.log(`Parsed UTC: ${e.parsedISO}`);
    });
}

run();

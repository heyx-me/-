import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const [,, conversationId, content, delayMs] = process.argv;

if (!conversationId || !content) {
    console.error("Usage: node notify.js <conversationId> <content> [delayMs]");
    process.exit(1);
}

setTimeout(async () => {
    console.log(`Sending scheduled message to ${conversationId}: ${content}`);
    const { data, error } = await supabase.from('messages').insert({
        room_id: 'rafi',
        conversation_id: conversationId,
        content: JSON.stringify({ type: 'text', content }),
        sender_id: 'alex-bot',
        is_bot: true
    });
    if (error) console.error("Error sending message:", error);
    else console.log("Message sent successfully");
    process.exit(0);
}, parseInt(delayMs) || 0);

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ quiet: true });

const SUPABASE_URL = "https://gsyozgedljmcpsysstpz.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const [,, conversationId] = process.argv;

if (!conversationId) {
    console.error("Usage: node trigger_rafi_fetch.js <conversationId>");
    process.exit(1);
}

async function trigger() {
    console.log(`Triggering FETCH for ${conversationId}`);
    const { data, error } = await supabase.from('messages').insert({
        room_id: 'rafi',
        conversation_id: conversationId,
        content: JSON.stringify({ action: 'FETCH' }),
        sender_id: conversationId,
        is_bot: false
    });
    if (error) console.error("Error sending message:", error);
    else console.log("FETCH action inserted successfully");
    process.exit(0);
}

trigger();

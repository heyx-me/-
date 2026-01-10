import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    console.log("Fetching messages for room 'alex'");
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', 'alex')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No messages found.");
    } else {
        console.log("Recent messages (Newest first):");
        data.forEach(msg => {
            console.log(`- [${msg.sender_id}] (${msg.is_bot ? 'BOT' : 'USER'}): ${msg.content}`);
        });
        
        const lastMsg = data[0];
        if (lastMsg.sender_id !== 'alex-bot') {
            console.log("\nCONCLUSION: The last message is from a USER. The agent SHOULD reply.");
        } else {
            console.log("\nCONCLUSION: The last message is from the BOT. The agent should wait.");
        }
    }
}

check();

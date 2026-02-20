import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMessages() {
    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    console.log(`Fetched ${messages.length} messages.`);
    messages.forEach(msg => {
        console.log(`[${msg.id}] ${msg.is_bot ? 'BOT' : 'USER'}: ${msg.content.substring(0, 100)}`);
        try {
            const json = JSON.parse(msg.content);
            console.log('  -> JSON:', Object.keys(json));
            if (json.action) console.log('  -> ACTION:', json.action);
            if (json.type) console.log('  -> TYPE:', json.type);
        } catch (e) {
            // Not JSON
        }
    });
}

checkMessages();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkThread() {
    const threadId = '667a6f77-2a13-4581-bd4e-4ace0daf17ec';
    console.log(`Checking thread: ${threadId}`);

    const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', threadId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }

    console.log(`Found ${messages.length} messages in this thread.`);
    messages.forEach(msg => {
        console.log(`--- [${msg.id}] ${msg.is_bot ? 'BOT' : 'USER'} at ${msg.created_at} ---`);
        console.log(`Content: ${msg.content}`);
        try {
            const json = JSON.parse(msg.content);
            console.log('Is valid JSON: Yes');
            console.log('Keys:', Object.keys(json));
        } catch (e) {
            console.log('Is valid JSON: No');
        }
    });
}

checkThread();

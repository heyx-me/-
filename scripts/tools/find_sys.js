import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function findSystemMessages() {
    const { data: messages, error } = await supabase
        .from('messages')
        .select('id, conversation_id, content')
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error:', error);
        return;
    }

    const filtered = messages.filter(m => m.content.includes('action') || m.content.includes('type'));
    console.log(`Found ${filtered.length} potential system messages in recent 50:`);
    filtered.forEach(m => {
        console.log(`ID: ${m.id}, Thread: ${m.conversation_id}, Content: ${m.content.substring(0, 50)}`);
    });
}

findSystemMessages();

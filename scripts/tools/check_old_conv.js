import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkOldConv() {
    const threadId = 'a56a1440-1b06-4890-ace3-8ef6b03a2edb';
    console.log(`Checking conversation: ${threadId}`);

    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', threadId)
        .single();

    if (error) {
        console.error('Error fetching conversation:', error);
    } else {
        console.log('Conversation Data:', data);
    }
}

checkOldConv();

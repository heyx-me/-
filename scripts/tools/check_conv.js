import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConversation() {
    const threadId = '667a6f77-2a13-4581-bd4e-4ace0daf17ec';
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

    // Also check if there are ANY messages in the DB for other threads to confirm DB connectivity/table name
    const { data: countData, error: countError } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true });
    
    if (countError) {
        console.error('Error counting messages:', countError);
    } else {
        console.log('Total messages in DB:', countData.length || 'Unknown (head only)');
    }
}

checkConversation();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMembership() {
    const threadId = '667a6f77-2a13-4581-bd4e-4ace0daf17ec';
    const userId = '02ff1def-a517-471f-b9fb-591d78207c5c';

    console.log(`Checking membership for User ${userId} in Thread ${threadId}`);

    const { data, error } = await supabase
        .from('conversation_members')
        .select('*')
        .eq('conversation_id', threadId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Membership:', data);
    }
}

checkMembership();

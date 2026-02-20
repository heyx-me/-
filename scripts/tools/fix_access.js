import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error("Missing SERVICE_KEY. Ensure .env exists and contains the key.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function fix() {
    const threadId = 'a56a1440-1b06-4890-ace3-8ef6b03a2edb';
    const userId = '02ff1def-a517-471f-b9fb-591d78207c5c';

    console.log(`Fixing access for User ${userId} to Thread ${threadId}`);

    // 1. Add Member (ignore duplicate error)
    const { error: memberError } = await supabase
        .from('conversation_members')
        .upsert({ conversation_id: threadId, user_id: userId }, { onConflict: 'conversation_id, user_id' });

    if (memberError) {
        console.error('Member Insert Error:', memberError);
    } else {
        console.log('Member added/verified successfully.');
    }

    // 2. Update App ID
    const { error: updateError } = await supabase
        .from('conversations')
        .update({ app_id: 'nanie' }) // Ensure it's marked as Nanie app
        .eq('id', threadId);

    if (updateError) {
        console.error('Update Error:', updateError);
    } else {
        console.log('Conversation updated successfully.');
    }
}

fix();

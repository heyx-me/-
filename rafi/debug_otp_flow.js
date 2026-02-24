import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function debugFlow() {
    const conversationId = uuidv4();
    const userId = uuidv4();
    
    console.log(`Starting debug flow for conversation: ${conversationId}`);

    // 1. Create conversation
    await supabase.from('conversations').upsert({
        id: conversationId,
        owner_id: userId,
        title: 'Debug OTP Flow'
    });

    // 2. Insert STATUS message (Verifying credentials)
    const { data: statusMsg, error: err1 } = await supabase.from('messages').insert({
        room_id: 'rafi',
        conversation_id: conversationId,
        content: JSON.stringify({ type: 'STATUS', text: 'Verifying credentials...', ephemeral: true }),
        sender_id: 'alex-bot',
        is_bot: true
    }).select().single();

    if (err1) {
        console.error("Failed to insert status message:", err1);
        return;
    }

    console.log(`Inserted status message: ${statusMsg.id}. UI should show syncing.`);

    // Wait a bit
    await new Promise(r => setTimeout(r, 3000));

    // 3. Update STATUS message to OTP_REQUIRED
    console.log(`Updating message ${statusMsg.id} to OTP_REQUIRED...`);
    const { error: err2 } = await supabase.from('messages').update({
        content: JSON.stringify({ type: 'OTP_REQUIRED', jobId: 'debug-job-' + Date.now(), ephemeral: true })
    }).eq('id', statusMsg.id);

    if (err2) {
        console.error("Failed to update message to OTP_REQUIRED:", err2);
        return;
    }

    console.log("Update sent. Check UI for OTP modal.");
    
    // Keep script running for a bit to allow observation
    await new Promise(r => setTimeout(r, 10000));
}

debugFlow().catch(console.error);

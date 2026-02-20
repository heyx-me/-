import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function sendHeartbeat() {
    const cid = 'd1fb8db8-2c46-413f-8393-de3da5d64434';
    console.log('Sending HEARTBEAT to trigger sync for', cid);
    
    await supabase.from('messages').insert({
        room_id: 'nanie',
        conversation_id: cid,
        content: JSON.stringify({ action: 'ADD_EVENT', text: 'סנכרון מערכת' }),
        sender_id: cid,
        is_bot: false
    });
    console.log('Done');
}

sendHeartbeat();
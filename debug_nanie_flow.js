import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    const conversationId = uuidv4();
    console.log(`[Test] Conversation ID: ${conversationId}`);

    // Subscribe
    const channel = supabase.channel(`test:${conversationId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages',
            filter: `room_id=eq.nanie`
        }, (payload) => {
            const msg = payload.new;
            if (msg.conversation_id === conversationId) {
                console.log(`[Test] Received msg from ${msg.sender_id}: ${msg.content.substring(0, 100)}`);
                if (msg.is_bot) {
                    try {
                        const json = JSON.parse(msg.content);
                        if (json.type === 'DATA') {
                            console.log("[Test] SUCCESS: Received DATA packet!");
                            process.exit(0);
                        }
                    } catch (e) {}
                }
            }
        })
        .subscribe((status) => {
             console.log(`[Test] Subscribed: ${status}`);
        });

    // Wait for sub
    await new Promise(r => setTimeout(r, 2000));

    console.log("[Test] Creating conversation...");
    const { error: convError } = await supabase.from('conversations').upsert({ 
        id: conversationId, 
        title: 'Debug Nanie',
        owner_id: uuidv4()
    });
    if (convError) console.error("[Test] Conv Error:", convError);

    console.log("[Test] Sending GET_STATUS...");
    const { error } = await supabase.from('messages').insert({
        room_id: 'nanie',
        conversation_id: conversationId,
        content: JSON.stringify({ action: 'GET_STATUS' }),
        sender_id: conversationId,
        is_bot: false
    });

    if (error) {
        console.error("[Test] Insert Error:", error);
        process.exit(1);
    }
    
    // Timeout
    setTimeout(() => {
        console.error("[Test] Timeout waiting for reply.");
        process.exit(1);
    }, 15000);
}

run();

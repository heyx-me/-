import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    const { data, error } = await supabase.from('conversations').select('*').limit(1);
    if (error) {
        console.error("Error fetching conversations:", error);
    } else if (data && data.length > 0) {
        console.log("Columns in conversations table:", Object.keys(data[0]));
    } else {
        // If empty, try to get schema info via rpc if available, or just insert/delete dummy
        console.log("Conversations table is empty. Trying to find columns another way...");
        const { data: cols, error: err } = await supabase.rpc('get_table_columns', { table_name: 'conversations' });
        if (err) console.error("RPC failed:", err);
        else console.log("Columns:", cols);
    }
}

run();

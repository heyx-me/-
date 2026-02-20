import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("Error:", error);
    console.log("Data:", JSON.stringify(data, null, 2));
}

run();

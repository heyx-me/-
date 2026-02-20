import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://gsyozgedljmcpsysstpz.supabase.co";
const SUPABASE_KEY = "sb_publishable_FJI1hrANejiwsKll-G4zMQ_wRR-Surp";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
    console.log("Testing connection...");
    const { data, error } = await supabase.from('messages').select('count', { count: 'exact', head: true });
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Success! Data:", data);
    }
}

test();

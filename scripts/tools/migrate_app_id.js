import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gsyozgedljmcpsysstpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function run() {
    console.log("Adding app_id column to conversations table...");
    
    // We use a raw RPC call if we had a query runner, but we don't.
    // However, Supabase doesn't have a direct "run_sql" rpc by default.
    // I will try to see if I can just use the select trick to check if it exists first.
    
    const { data: check, error: checkError } = await supabase.from('conversations').select('app_id').limit(1);
    
    if (checkError && checkError.code === '42703') { // Column does not exist
        console.log("Column 'app_id' is missing. You need to add it manually in the Supabase Dashboard or via SQL.");
        console.log("SQL: ALTER TABLE public.conversations ADD COLUMN app_id TEXT;");
        
        // Since I can't run raw SQL via the client without a custom RPC, 
        // I will check if there is any other way. 
        // Actually, many of these projects have an 'exec_sql' RPC for migrations.
        
        const { error: sqlError } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE public.conversations ADD COLUMN app_id TEXT;' });
        if (sqlError) {
            console.error("Failed to add column via RPC:", sqlError);
            process.exit(1);
        } else {
            console.log("Successfully added 'app_id' column.");
        }
    } else if (checkError) {
        console.error("Error checking column:", checkError);
        process.exit(1);
    } else {
        console.log("'app_id' column already exists.");
    }
}

run();

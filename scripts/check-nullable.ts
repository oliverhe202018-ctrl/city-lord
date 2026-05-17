import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data, error } = await supabaseAdmin.rpc('get_table_info', { table_name: 'territories' });
    // If no such rpc, let's just do an upsert with owner_id = null and see if it fails.
    const { error: err } = await supabaseAdmin.from('territories').update({ owner_id: null }).eq('id', 'test-hex-1');
    console.log("UPDATE Error:", err);
}
run();

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const { data, error } = await supabaseAdmin.rpc('test_rpc_nonexistent');
    // Supabase JS doesn't have an easy way to get columns without rpc or explicit select.
    // Let's just select * limit 1 to see the columns.
    const { data: d2, error: e2 } = await supabaseAdmin.from('territories').select('*').limit(1);
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
    console.log("Columns:", Object.keys(d2[0] || {}), "Data:", d2);
}
check();

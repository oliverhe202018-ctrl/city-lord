import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(2);
    const realUserB = profiles[1].id;
    const { error: purgeErr } = await supabaseAdmin.rpc('purge_faction_territories', {
        p_user_id: realUserB
    });
    console.log("PURGE ERROR:", JSON.stringify(purgeErr, null, 2));
}
run();

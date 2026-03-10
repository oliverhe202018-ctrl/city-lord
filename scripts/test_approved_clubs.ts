import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: approvedClubs, error } = await supabaseAdmin
        .from('clubs')
        .select('*, profiles_clubs_owner_idToprofiles:profiles!clubs_owner_id_fkey(nickname)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    console.log("Error:", error);
    console.log("Data length:", approvedClubs?.length);
    if (approvedClubs && approvedClubs.length > 0) {
        console.log("First item:", approvedClubs[0]);
    }
}
main();

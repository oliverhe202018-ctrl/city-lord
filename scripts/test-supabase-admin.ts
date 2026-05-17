import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabaseAdmin
        .from('clubs')
        .select('*, profiles_clubs_owner_idToprofiles:profiles!clubs_owner_id_fkey(nickname)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching clubs:', error);
    } else {
        console.log(`Clubs: ${data?.length}`);
        console.log(data?.[0])
    }
}

main();

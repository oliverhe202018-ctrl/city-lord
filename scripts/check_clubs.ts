import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabaseAdmin
        .from('clubs')
        .select('id, name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching clubs:', error);
    } else {
        console.log('Clubs raw data:');
        console.log(JSON.stringify(data, null, 2));
    }
}
main();

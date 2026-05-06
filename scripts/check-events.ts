import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const { data, error } = await supabaseAdmin
        .from('territory_events')
        .select('event_type');

    if (error) {
        console.error(error);
        return;
    }

    const types = new Set(data.map(d => d.event_type));
    console.log("Distinct event types in DB:", Array.from(types));
}
check();

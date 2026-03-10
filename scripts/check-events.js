const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const { data, error } = await supabaseAdmin
        .from('territory_events')
        .select('event_type');

    if (error) {
        console.error(error);
        return;
    }

    const types = new Set(data.map(d => d.event_type));
    console.log("Distinct event types in DB:", Array.from(types));
})();

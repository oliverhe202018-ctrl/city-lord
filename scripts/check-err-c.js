const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').limit(2);
    const realUserB = profiles[1].id;
    const { data: clubs } = await supabaseAdmin.from('clubs').select('id').limit(1);
    const realClubId = clubs[0].id;
    const { error } = await supabaseAdmin.from('territories').upsert([
        { id: 'test-hex-1', city_id: 'city_test', owner_id: realUserB, owner_club_id: realClubId, owner_faction: 'Red', health: 100 }
    ]);
    console.log("ERROR OUTPUT:", JSON.stringify(error, null, 2));
})();

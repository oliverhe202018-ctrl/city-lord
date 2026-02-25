import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function test() {
    const { data, error } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: '17673773888@sms.citylord.local',
    })
    console.log(JSON.stringify(data, null, 2))
}
test()

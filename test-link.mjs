import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eyxlkuvxbihueplaqcbq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5eGxrdXZ4YmlodWVwbGFxY2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY3Njg1OSwiZXhwIjoyMDg1MjUyODU5fQ.PZVHv9PrtFdHVT91M4ooVQo8-_HecxpuM_Q07dzTuTg'

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

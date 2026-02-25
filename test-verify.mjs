import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://eyxlkuvxbihueplaqcbq.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5eGxrdXZ4YmlodWVwbGFxY2JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY3Njg1OSwiZXhwIjoyMDg1MjUyODU5fQ.PZVHv9PrtFdHVT91M4ooVQo8-_HecxpuM_Q07dzTuTg'
const supabaseAnonKey = 'sb_publishable_g2nlqSFI3zhwMnjs1037iA_LVhXFC5o'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: '17673773888@sms.citylord.local',
    })

    if (error) {
        console.error("Link error:", error)
        return
    }

    const tokenHash = data.properties.hashed_token;
    console.log("Hashed Token:", tokenHash);

    const { data: verifyData, error: verifyError } = await supabaseAnon.auth.verifyOtp({
        email: '17673773888@sms.citylord.local',
        token_hash: tokenHash,
        type: 'magiclink'
    })

    if (verifyError) {
        console.error("Verify error:", verifyError)
    } else {
        console.log("Success! Session obtained:", !!verifyData.session)
    }
}
test()

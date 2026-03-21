// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
import { supabaseAdmin } from './lib/supabase/admin'

async function test() {
    console.log('Testing existingClub...')
    const { data: existingClub } = await supabaseAdmin
        .from('clubs')
        .select('id')
        .eq('name', 'Test Club A')
        .maybeSingle()
    console.log('existingClub:', existingClub)

    console.log('\nTesting pendingClubs...')
    const { data: pendingClubs } = await supabaseAdmin
        .from('clubs')
        .select('*, profiles_clubs_owner_idToprofiles:profiles!clubs_owner_id_fkey(nickname, avatar_url)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    console.log('pendingClubs count:', pendingClubs?.length)

    console.log('\nTesting clubs...')
    const { data: clubs } = await supabaseAdmin
        .from('clubs')
        .select('*, club_members(user_id)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
    console.log('clubs count:', clubs?.length)

    console.log('\nTesting membership...')
    const { data: membership } = await supabaseAdmin
        .from('club_members')
        .select('*, clubs(*)')
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()
    console.log('membership has club?', !!membership?.clubs)

    console.log('\nTesting rank stats...')
    const { count: globalRank } = await supabaseAdmin
        .from('clubs')
        .select('*', { count: 'exact', head: true })
        .gt('total_area', 0)
        .eq('status', 'active')
    console.log('globalRank count:', globalRank)

    console.log('\nTesting club details...')
    const { data: members } = await supabaseAdmin
        .from('club_members')
        .select('*, profiles(*)')
        .eq('status', 'active')
        .limit(1)
    console.log('members with profiles count:', members?.length)
}

test().catch(console.error)

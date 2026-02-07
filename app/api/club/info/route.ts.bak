import { NextResponse } from 'next/server'
import { getClubs } from '@/app/actions/club'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-static'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ joinedClub: null, allClubs: [] })
    }

    // 1. Check if user is in a club
    const { data: member } = await supabase
        .from('club_members')
        .select('club_id, status')
        .eq('user_id', user.id)
        .single()
    
    // 2. Fetch all clubs list (reusing action logic)
    const allClubs = await getClubs()

    // 3. If user is in a club, fetch that specific club details
    let joinedClub = null
    if (member && member.status === 'active') {
        const { data: clubDetails } = await supabase
            .from('clubs')
            .select('*')
            .eq('id', member.club_id)
            .single()
        
        if (clubDetails) {
            joinedClub = clubDetails
        }
    } else {
        // Check if owner
         const { data: ownerClub } = await supabase
            .from('clubs')
            .select('*')
            .eq('owner_id', user.id)
            .single()
         if (ownerClub) {
             joinedClub = ownerClub
         }
    }

    return NextResponse.json({
        joinedClub,
        allClubs
    })

  } catch (error) {
    console.error('API Error [ClubInfo]:', error)
    return NextResponse.json({ error: 'Failed to fetch club info' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const clubId = searchParams.get('clubId')
    
    const cookieStore = await cookies()
    const supabase = await createClient(cookieStore)

    // =================================================================
    // MODE 1: Single Club Detail (Optimized for Speed)
    // =================================================================
    if (clubId) {
        // 1. Basic Info
        const { data: club, error } = await supabase
            .from('clubs')
            .select('*')
            .eq('id', clubId)
            .single()

        if (error || !club) {
            return NextResponse.json({ error: 'Club not found' }, { status: 404 })
        }

        // 2. Member Count (Exact count, no data fetch)
        const { count: memberCount } = await supabase
            .from('club_members')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', clubId)

        // 3. Territory Area (Return 0 for speed as requested)
        // Note: Real calculation requires PostGIS/Turf.js which is slow
        const totalArea = 0

        return NextResponse.json({
            ...club,
            memberCount: memberCount || 0,
            totalArea
        })
    }

    // =================================================================
    // MODE 2: Dashboard / List View (Legacy Support)
    // Used by useClubData() hook
    // =================================================================
    
    // Check Auth
    let user = null
    try {
        const { data } = await supabase.auth.getUser()
        user = data.user
    } catch (e) {
        // ignore auth error
    }

    // 1. Fetch User's Club Status
    let joinedClub = null
    if (user) {
        const { data: member } = await supabase
            .from('club_members')
            .select('club_id, status')
            .eq('user_id', user.id)
            .single()
            
        if (member && member.status === 'active') {
             const { data: myClub } = await supabase
                .from('clubs')
                .select('*')
                .eq('id', member.club_id)
                .single()
             joinedClub = myClub
        }
    }

    // 2. Fetch All Active Clubs (Pure Supabase, No External Fetch)
    // Optimized: Only select necessary fields
    const { data: allClubs } = await supabase
        .from('clubs')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50) // Safety limit

    return NextResponse.json({
        joinedClub,
        allClubs: allClubs || []
    })

  } catch (error) {
    console.error('API Error [ClubInfo]:', error)
    return NextResponse.json({ error: 'Failed to fetch club info' }, { status: 500 })
  }
}

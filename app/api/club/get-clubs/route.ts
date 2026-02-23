import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClubs } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clubs = await getClubs()
    return NextResponse.json(clubs || [])
  } catch (error: any) {
    console.error('getClubs error:', error)
    return NextResponse.json([], { status: 200 })
  }
}

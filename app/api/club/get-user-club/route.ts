import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserClub } from '@/app/actions/club'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const data = await getUserClub()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('getUserClub error:', error)
    return NextResponse.json(null, { status: 200 })
  }
}

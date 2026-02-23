import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClub } from '@/app/actions/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    if (!body?.name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }

    const result = await createClub(body)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('createClub error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to create club' }, { status: 500 })
  }
}

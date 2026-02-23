import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { joinFaction } from '@/app/actions/faction'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { faction } = body || {}

    if (!faction) {
      return NextResponse.json({ error: 'faction required' }, { status: 400 })
    }

    const result = await joinFaction(faction)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('joinFaction error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to join faction' }, { status: 500 })
  }
}

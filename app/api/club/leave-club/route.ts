import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { leaveClub } from '@/app/actions/club'
import { LeaveClubSchema } from '@/lib/schemas/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = LeaveClubSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const result = await leaveClub(parsed.data.clubId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('leaveClub error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to leave club' }, { status: 500 })
  }
}

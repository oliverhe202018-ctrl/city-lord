import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { kickMember } from '@/app/actions/club'
import { ClubMemberActionSchema } from '@/lib/schemas/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ClubMemberActionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { clubId, memberId } = parsed.data
    const result = await kickMember(clubId, memberId)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('kickMember error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to kick member' }, { status: 500 })
  }
}

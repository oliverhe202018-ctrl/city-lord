import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateClubInfo } from '@/app/actions/club'
import { UpdateClubInfoSchema } from '@/lib/schemas/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = UpdateClubInfoSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { clubId, ...data } = parsed.data
    const result = await updateClubInfo(clubId, data)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('updateClubInfo error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to update club' }, { status: 500 })
  }
}

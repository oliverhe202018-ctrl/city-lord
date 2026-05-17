import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processJoinRequest } from '@/app/actions/club'
import { ProcessJoinRequestSchema } from '@/lib/schemas/club'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ProcessJoinRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const { clubId, requestId, action } = parsed.data

    const result = await processJoinRequest(clubId, requestId, action)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('processJoinRequest error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Failed to process request' }, { status: 500 })
  }
}

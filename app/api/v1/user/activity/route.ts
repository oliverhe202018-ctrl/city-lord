import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }
    const token = authHeader.substring(7)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    await prisma.profiles.update({
      where: { id: user.id },
      data: { updated_at: new Date() },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[user/activity] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
  }
}

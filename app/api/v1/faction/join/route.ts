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

    const { faction } = await request.json()
    if (!faction || !['RED', 'BLUE'].includes(faction)) {
      return NextResponse.json({ success: false, error: 'Invalid faction' }, { status: 400 })
    }

    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { last_faction_change_at: true, faction: true },
    })

    if (profile?.last_faction_change_at) {
      const daysSinceChange = (Date.now() - profile.last_faction_change_at.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceChange < 7) {
        const remaining = Math.ceil(7 - daysSinceChange)
        return NextResponse.json({ success: false, error: `阵营冷却中，请 ${remaining} 天后再试` }, { status: 400 })
      }
    }

    if (profile?.faction === (faction === 'RED' ? 'Red' : 'Blue')) {
      return NextResponse.json({ success: false, error: '你已经在该阵营中' }, { status: 400 })
    }

    await prisma.profiles.update({
      where: { id: user.id },
      data: {
        faction: faction === 'RED' ? 'Red' : 'Blue',
        last_faction_change_at: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Join faction exception:', err)
    return NextResponse.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 })
  }
}

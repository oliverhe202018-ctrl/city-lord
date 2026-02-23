import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userBadges = await prisma.user_badges.findMany({
      where: { user_id: user.id },
      include: {
        badges: true
      },
      orderBy: { earned_at: 'desc' }
    })

    return NextResponse.json({ 
      success: true, 
      data: userBadges.map(ub => ({
        ...ub.badges,
        earned_at: ub.earned_at
      }))
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

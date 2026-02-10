import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const name = String(body?.name || '').trim()

    if (!name) {
      return NextResponse.json({ error: 'Club name is required' }, { status: 400 })
    }

    const created = await prisma.$transaction(async (tx) => {
      const club = await tx.clubs.create({
        data: {
          name,
          description: body?.description ?? null,
          owner_id: user.id,
          avatar_url: body?.avatar_url ?? null,
          province: body?.province ?? null,
          is_public: body?.is_public ?? true,
          status: 'pending',
          level: '1',
          rating: 0,
          member_count: 1,
          territory: '0'
        }
      })

      await tx.club_members.create({
        data: {
          club_id: club.id,
          user_id: user.id,
          role: 'owner',
          status: 'active'
        }
      })

      return club
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create club' }, { status: 500 })
  }
}

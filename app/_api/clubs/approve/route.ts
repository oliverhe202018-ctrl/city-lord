import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await prisma.app_admins.findUnique({ where: { id: user.id } })
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const clubId = String(body?.clubId || '').trim()

    if (!clubId) {
      return NextResponse.json({ error: 'Club ID is required' }, { status: 400 })
    }

    const club = await prisma.clubs.update({
      where: { id: clubId },
      data: { status: 'active' }
    })

    revalidatePath('/game/clubs')

    return NextResponse.json({ success: true, data: club })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to approve club' }, { status: 500 })
  }
}

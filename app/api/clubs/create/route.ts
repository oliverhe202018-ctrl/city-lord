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
    const { name, description, province, avatar_url } = body

    if (!name || !province) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check for duplicate name
    const existingClub = await prisma.clubs.findUnique({
      where: { name }
    })

    if (existingClub) {
      return NextResponse.json({ error: '俱乐部名称已存在' }, { status: 400 })
    }

    // Use Prisma to create club (Service Role)
    const newClub = await prisma.clubs.create({
      data: {
        name,
        description,
        province,
        avatar_url,
        owner_id: user.id,
        status: 'pending', // Requires approval
        member_count: 1
      }
    })

    // Add owner as member
    await prisma.club_members.create({
      data: {
        club_id: newClub.id,
        user_id: user.id,
        role: 'owner',
        status: 'active'
      }
    })

    // Update user profile with club_id
    await prisma.profiles.update({
        where: { id: user.id },
        data: { club_id: newClub.id }
    })

    return NextResponse.json({ success: true, data: newClub })
  } catch (error: any) {
    console.error('Error creating club:', error)
    // Handle Prisma unique constraint violation explicitly just in case
    if (error.code === 'P2002') {
        return NextResponse.json({ error: '俱乐部名称已存在，请换一个名字' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const [totalUsers, activeClubs, pendingClubs, redFaction, blueFaction] = await Promise.all([
      prisma.profiles.count(),
      prisma.clubs.count({ where: { status: 'active' } }),
      prisma.clubs.count({ where: { status: 'pending' } }),
      prisma.profiles.count({ where: { faction: 'Red' } }),
      prisma.profiles.count({ where: { faction: 'Blue' } })
    ])

    // Get new users today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newUsersToday = await prisma.profiles.count({
      where: {
        created_at: {
          gte: today.toISOString()
        }
      }
    })

    return NextResponse.json({
      total_users: totalUsers,
      total_clubs: activeClubs,
      pending_audit: pendingClubs,
      red_faction: redFaction,
      blue_faction: blueFaction,
      new_users_today: newUsersToday
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

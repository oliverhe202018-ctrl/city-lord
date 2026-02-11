import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { HEX_AREA_SQ_METERS } from '@/lib/citylord/area-utils'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const secret = url.searchParams.get('secret')
  if (process.env.NODE_ENV === 'production' && secret !== process.env.CRON_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const redCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Red'
        }
      }
    })

    const blueCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Blue'
        }
      }
    })

    const redArea = redCount * HEX_AREA_SQ_METERS
    const blueArea = blueCount * HEX_AREA_SQ_METERS

    const stats = await prisma.faction_stats_snapshot.upsert({
      where: { id: 'latest' },
      update: {
        red_area: redArea,
        blue_area: blueArea,
        updated_at: new Date()
      },
      create: {
        id: 'latest',
        red_area: redArea,
        blue_area: blueArea,
        updated_at: new Date()
      }
    })

    return NextResponse.json({
      red_count: redCount,
      blue_count: blueCount,
      red_area: redArea,
      blue_area: blueArea,
      snapshot: stats
    })
  } catch (error) {
    console.error('Error updating faction stats:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

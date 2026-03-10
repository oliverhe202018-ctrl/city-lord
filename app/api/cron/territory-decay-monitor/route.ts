import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Phase 2B-1: OBSERVE ONLY Decay Monitor
        // Identify territories that haven't been maintained in > 3 days
        const thresholdDate = new Date()
        thresholdDate.setDate(thresholdDate.getDate() - 3)

        const starvingTerritories = await prisma.$queryRaw<any[]>`
      SELECT id, owner_id, owner_club_id, health, last_maintained_at
      FROM public.territories
      WHERE last_maintained_at < ${thresholdDate}
      LIMIT 100
    `

        console.log(`[Decay Monitor - OBSERVE MODE] Found ${starvingTerritories.length} territories exceeding 3-day starvation threshold.`)
        if (starvingTerritories.length > 0) {
            console.log(`[Decay Monitor] Sample starving territory: ${starvingTerritories[0].id}, Health: ${starvingTerritories[0].health}, Last Maintained: ${starvingTerritories[0].last_maintained_at}`)
        }

        // Phase 2B-2 will add actual health deduction here.

        return NextResponse.json({
            success: true,
            mode: 'OBSERVE_ONLY',
            starvingCount: starvingTerritories.length
        })
    } catch (error: any) {
        console.error('[Decay Monitor] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

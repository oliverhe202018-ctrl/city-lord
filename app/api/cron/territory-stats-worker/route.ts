import { NextResponse } from 'next/server'
import { TerritoryStatsAggregatorService } from '@/lib/services/territory-stats-aggregator'

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        // Vercel Cron sends a CRON_SECRET header in production
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // In local dev, CRON_SECRET might be empty, so we allow it if undefined,
            // but in prod it strictly requires the Vercel secret token.
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const params = new URL(request.url).searchParams
        // Optional manual trigger bypass
        const manualTrigger = params.get('trigger') === 'manual'

        const result = await TerritoryStatsAggregatorService.processNextBatch()

        // Log for observation according to Phase 2B-1
        console.log(`[Territory Stats Aggregator] Processed: ${result.processed}, LastCursor: ${result.lastEventId}`)

        return NextResponse.json({ success: true, ...result })
    } catch (error: any) {
        console.error('[Territory Stats Aggregator] CRITICAL Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Worker processing failed' },
            { status: 500 }
        )
    }
}

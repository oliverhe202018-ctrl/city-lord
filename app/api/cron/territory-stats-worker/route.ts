import { NextResponse } from 'next/server'
import { TerritoryStatsAggregatorService } from '@/lib/services/territory-stats-aggregator'

export async function GET(request: Request) {
    try {
        // [P6] Fail-closed: CRON_SECRET 未配置时直接 503
        if (!process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Cron disabled: CRON_SECRET not configured' }, { status: 503 })
        }
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

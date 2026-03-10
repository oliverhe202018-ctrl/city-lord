import { NextResponse } from 'next/server'
import { TerritoryReconcileService } from '@/lib/services/territory-reconcile'

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const params = new URL(request.url).searchParams
        const manualTrigger = params.get('trigger') === 'manual'

        const result = await TerritoryReconcileService.runReconcile()
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('[Territory Reconcile] CRITICAL Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Reconcile failed' },
            { status: 500 }
        )
    }
}

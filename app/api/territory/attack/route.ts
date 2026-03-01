/**
 * POST /api/territory/attack
 *
 * @internal — Debug/development endpoint for territory HP attacks.
 *
 * In PRODUCTION, territory attacks are triggered automatically during
 * run settlement (POST /api/sync/run) when the backend detects the
 * runner's GPS trajectory intersects enemy territory H3 tiles.
 *
 * This endpoint is retained for:
 *   - Manual testing and debugging during development
 *   - Admin tools (future)
 *
 * In production, this route is DISABLED.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TerritoryHPService } from '@/lib/services/territory-hp-service'

export async function POST(request: Request) {
    // ── Gate: Only allow in development ──
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'This endpoint is disabled in production. Use /api/sync/run.' },
            { status: 403 }
        )
    }

    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await request.json()
        const { territoryId, cityId, intersectionAreaM2 } = body

        if (!territoryId || !cityId) {
            return NextResponse.json(
                { error: 'territoryId and cityId are required' },
                { status: 400 }
            )
        }

        const result = await TerritoryHPService.attackTerritory({
            attackerId: user.id,
            territoryId,
            cityId,
            intersectionAreaM2,
        })

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Attack territory error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Attack failed' },
            { status: 500 }
        )
    }
}

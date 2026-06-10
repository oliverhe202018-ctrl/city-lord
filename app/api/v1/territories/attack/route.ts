import { createClient } from '@/lib/supabase/server'
import { TerritoryHPService } from '@/lib/services/territory-hp-service'
import { withErrorHandler, successResponse } from '@/lib/api/with-handler'
import { AppError, ErrorCode } from '@/lib/api/errors'

export const POST = withErrorHandler(async (request: Request) => {
    // ── Gate: Only allow in development ──
    if (process.env.NODE_ENV === 'production') {
        throw new AppError(
            ErrorCode.AUTH_FORBIDDEN, 
            'This endpoint is disabled in production. Use /api/sync/run.',
            403
        )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, 'Not authenticated', 401)
    }

    const body = await request.json()
    const { territoryId, cityId, intersectionAreaM2 } = body

    if (!territoryId || !cityId) {
        throw new AppError(ErrorCode.BIZ_VALIDATION_FAILED, 'territoryId and cityId are required', 400)
    }

    const result = await TerritoryHPService.attackTerritory({
        attackerId: user.id,
        territoryId,
        cityId,
        intersectionAreaM2,
    })

    return successResponse(result)
})

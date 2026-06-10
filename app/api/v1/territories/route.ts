import { fetchTerritories } from '@/app/actions/city'
import { createClient } from '@/lib/supabase/server'
import { withErrorHandler, successResponse } from '@/lib/api/with-handler'
import { AppError, ErrorCode } from '@/lib/api/errors'

export const GET = withErrorHandler(async (request: Request) => {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined

    if (!token) {
        throw new AppError(ErrorCode.AUTH_TOKEN_MISSING, '未提供访问令牌', 401)
    }

    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        throw new AppError(ErrorCode.AUTH_TOKEN_EXPIRED, '令牌无效或已过期', 401)
    }

    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId') || 'global'
    const minLng = searchParams.get('minLng')
    const minLat = searchParams.get('minLat')
    const maxLng = searchParams.get('maxLng')
    const maxLat = searchParams.get('maxLat')

    let bounds: any = undefined
    if (minLng && minLat && maxLng && maxLat) {
        bounds = {
            minLng: parseFloat(minLng),
            minLat: parseFloat(minLat),
            maxLng: parseFloat(maxLng),
            maxLat: parseFloat(maxLat)
        }
    }

    const data = await fetchTerritories(cityId, bounds, token)
    return successResponse(data)
})

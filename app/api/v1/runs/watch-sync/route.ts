import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WatchSyncPayloadSchema } from '@/lib/schemas/watch-sync';
import { ActivityService } from '@/lib/services/activity-service';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';
import { AppError, ErrorCode } from '@/lib/api/errors';

function extractBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice('Bearer '.length).trim() || null;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
    // 1. Extract API key from Authorization header
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
        throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, '缺少授权凭证，请在 Authorization 头部提供 Bearer Token');
    }

    // 2. Look up user by api_key
    const profile = await prisma.profiles.findUnique({
        where: { api_key: apiKey },
        select: { id: true },
    });

    if (!profile) {
        throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, '无效的 API Key，请在个人设置中获取');
    }

    const userId = profile.id;

    // 3. Parse request body
    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        throw new AppError(ErrorCode.REQ_BAD_PARAM, '请求体必须是合法的 JSON 格式');
    }

    // 4. Zod validation
    const parseResult = WatchSyncPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        const path = firstError.path.join('.') || 'root';
        throw new AppError(ErrorCode.REQ_BAD_PARAM, `数据验证失败 (${path}): ${firstError.message}`);
    }

    const { externalId, sourceApp, ...payload } = parseResult.data;

    // 5. Process via ActivityService (same pipeline as Server Action)
    const result = await ActivityService.processWatchData(userId, payload, {
        externalId: externalId || undefined, // Explicitly pass externalId
        sourceApp: sourceApp ?? 'API',
        rawData: rawBody,
    });

    if (!result.success) {
        throw new AppError(ErrorCode.BIZ_LOGIC_ERROR, result.error || 'Watch sync failed');
    }

    return successResponse({
        activityId: result.activityId,
        runId: result.runId,
        territoryCreated: result.territoryCreated,
        territoryArea: result.territoryArea,
        warnings: result.warnings,
    });
});

export async function GET() {
    return NextResponse.json({ status: 'ok', endpoint: 'POST /api/v1/runs/watch-sync', version: '1.0' });
}

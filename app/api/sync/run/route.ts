/**
 * POST /api/sync/run
 *
 * REST webhook for external tools (e.g. iOS Shortcuts, Zapier) to upload
 * running data directly without the App.
 *
 * Auth:  Authorization: Bearer <api_key>
 * Body:  WatchSyncPayload (JSON)
 *
 * The api_key is looked up in `profiles.api_key` to identify the user.
 * Data is processed by ActivityService (same pipeline as the Server Action).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WatchSyncPayloadSchema } from '@/lib/schemas/watch-sync';
import { ActivityService } from '@/lib/services/activity-service';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status });
}

function extractBearerToken(req: NextRequest): string | null {
    const auth = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice('Bearer '.length).trim() || null;
}

// ─────────────────────────────────────────────────────────────
// Route Handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    // 1. Extract API key from Authorization header
    const apiKey = extractBearerToken(req);
    if (!apiKey) {
        return json({ success: false, error: '缺少授权凭证，请在 Authorization 头部提供 Bearer Token' }, 401);
    }

    // 2. Look up user by api_key
    const profile = await prisma.profiles.findUnique({
        where: { api_key: apiKey },
        select: { id: true },
    });

    if (!profile) {
        return json({ success: false, error: '无效的 API Key，请在个人设置中获取' }, 401);
    }

    const userId = profile.id;

    // 3. Parse request body
    let rawBody: unknown;
    try {
        rawBody = await req.json();
    } catch {
        return json({ success: false, error: '请求体必须是合法的 JSON 格式' }, 400);
    }

    // 4. Zod validation
    const parseResult = WatchSyncPayloadSchema.safeParse(rawBody);
    if (!parseResult.success) {
        const firstError = parseResult.error.errors[0];
        const path = firstError.path.join('.') || 'root';
        return json(
            { success: false, error: `数据验证失败 (${path}): ${firstError.message}` },
            422,
        );
    }

    const { externalId, sourceApp, ...payload } = parseResult.data;

    // 5. Process via ActivityService (same pipeline as Server Action)
    try {
        const result = await ActivityService.processWatchData(userId, payload, {
            externalId: externalId, // Explicitly pass externalId
            sourceApp: sourceApp ?? 'API',
            rawData: rawBody,
        });

        if (!result.success) {
            return json({ success: false, error: result.error }, 422);
        }

        return json({
            success: true,
            activityId: result.activityId,
            runId: result.runId,
            territoryCreated: result.territoryCreated,
            territoryArea: result.territoryArea,
            warnings: result.warnings,
        });

    } catch (e) {
        console.error('[POST /api/sync/run] Unexpected error:', e);
        return json(
            { success: false, error: `服务器内部错误：${e instanceof Error ? e.message : '未知错误'}` },
            500,
        );
    }
}

// ─────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────

export async function GET() {
    return json({ status: 'ok', endpoint: 'POST /api/sync/run', version: '1.0' });
}

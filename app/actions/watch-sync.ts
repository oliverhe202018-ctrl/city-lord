'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ActivityService } from '@/lib/services/activity-service';
import { revalidatePath } from 'next/cache';
// 如果你有单独的类型定义文件，请保留导入；如果没有，可以使用下面 Zod 推导的类型
import type { WatchSyncResult } from '@/types/watch-sync';

import { WatchSyncPayloadSchema } from '@/lib/schemas/watch-sync';

// ============================================================
// Server Action
// ============================================================

/**
 * Server Action: Upload and process smartwatch running data.
 * * Auth: Supabase Auth required.
 * Validation: Zod schema with strict point/summary validation.
 * Processing: Delegates to ActivityService pipeline.
 */
export async function syncWatchRunData(
    rawPayload: unknown
): Promise<WatchSyncResult> {
    try {
        // 1. Auth check (Supabase)
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        // 检查 user 和 user.id 是否存在
        if (authError || !user || !user.id) {
            return {
                success: false,
                error: '未授权：请先登录',
            };
        }

        const userId = user.id;

        // 2. Zod validation
        const parseResult = WatchSyncPayloadSchema.safeParse(rawPayload);
        if (!parseResult.success) {
            // 扁平化错误信息，取第一个错误
            const firstError = parseResult.error.errors[0];
            const path = firstError.path.join('.') || 'root';
            return {
                success: false,
                error: `数据验证失败 (${path}): ${firstError.message}`,
            };
        }

        const validatedPayload = parseResult.data;
        const { externalId, sourceApp, ...payloadData } = validatedPayload;

        // 3. Additional business validation: check for impossible speeds
        for (let i = 1; i < payloadData.points.length; i++) {
            const prev = payloadData.points[i - 1];
            const curr = payloadData.points[i];
            const timeDiffSec = (curr.timestamp - prev.timestamp) / 1000;
            if (timeDiffSec > 0 && curr.pace != null && curr.pace > 100) {
                return {
                    success: false,
                    error: `第 ${i} 个点的配速异常（${curr.pace} km/h），超出人体极限`,
                };
            }
        }

        // 4. Process via ActivityService
        // 注意：ActivityService 内部需要处理 prisma 事务
        const result = await ActivityService.processWatchData(userId, payloadData, {
            externalId,
            sourceApp,
            rawData: rawPayload, // store original unvalidated payload for debugging
        });

        // 5. Revalidate cached pages on success
        if (result.success) {
            revalidatePath('/watch-sync');
            revalidatePath('/dashboard');
            revalidatePath('/profile/me');
        }

        return result;

    } catch (e) {
        console.error('[watch-sync action] Unexpected error:', e);
        return {
            success: false,
            error: `服务器内部错误：${e instanceof Error ? e.message : '未知错误'}`,
        };
    }
}
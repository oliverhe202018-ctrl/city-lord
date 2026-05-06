import { z } from 'zod';

export const WatchTrackPointSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    timestamp: z.number().positive(), // 毫秒级时间戳
    heartRate: z.number().min(0).max(300).optional().nullable().transform(val => val ?? undefined), // 允许 null 或 undefined
    pace: z.number().min(0).optional().nullable().transform(val => val ?? undefined),
});

export const WatchRunSummarySchema = z.object({
    totalDistance: z.number().min(0),
    totalSteps: z.number().int().min(0),
    // 兼容 ISO 字符串或非空字符串
    startTime: z.string().min(1),
    endTime: z.string().min(1),
});

// 导出这个 Schema 供前端或类型定义使用
export const WatchSyncPayloadSchema = z.object({
    points: z
        .array(WatchTrackPointSchema)
        .min(10, { message: '轨迹点数量不足，至少需要 10 个点' }),
    summary: WatchRunSummarySchema,
    /** External system's unique ID — used for server-side deduplication */
    externalId: z.string().min(1).optional(),
    /** Source app name, e.g. "HealthKit", "Strava", "Garmin" */
    sourceApp: z.string().min(1).optional(),
});

export type WatchSyncPayload = z.infer<typeof WatchSyncPayloadSchema>;


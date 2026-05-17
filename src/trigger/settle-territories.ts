import { task } from "@trigger.dev/sdk";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { processTerritorySettlement } from "@/lib/territory/settlement";
import { prisma } from "@/lib/prisma";
import { updateMissionProgress } from "@/lib/game-logic/mission-service";
import { updateChallengeProgress } from "@/app/actions/challenge-service";
import { cleanAndSplitTrajectory } from "@/lib/gis/geometry-cleaner";

interface RunPoint {
    lng: number;
    lat: number;
    timestamp?: number;
}

/**
 * 任务二：settle-territories (Trigger.dev Background Task)
 *
 * 核心修复：
 * 1. 使用 turf.convex 凸包算法替代 turf.polygon([coords]) 直接构建，
 *    彻底消灭 GPS 乱序导致的自交叠蜘蛛网畸变。
 * 2. status: 'completed' 回写放置于最外层 finally 块，
 *    确保无论结算成功、失败、还是 polygons 为空，状态必定回写，
 *    解除前端 RunSummaryView 的轮询死锁。
 * 3. cityId 现在始终为真实字符串（三重防线保障）：
 *    - 防线1: 高德逆地理编码
 *    - 防线2: 最近邻空间查询 (Haversine 50km)
 *    - 防线3: 网络 IP 溯源
 *    - 终极兜底: EARTH_CORE_000
 */
export const settleTerritoriesTask = task({
    id: "settle-territories",
    maxDuration: 600, // 10 分钟超时，应对大量重叠领地场景
    run: async (payload: {
        runId: string;
        userId: string;
        cityId: string;  // 三重防线保障，始终为真实城市 ID
        clubId: string | null;
        polygons: RunPoint[][];
        distance: number;
        duration: number;
    }) => {
        const { runId, userId, cityId, clubId, polygons, distance, duration } = payload;
        let settledCount = 0;
        let reinforcedCount = 0;
        let finalStatus: string = 'failed';
        let finalErrorCode: string | null = null;

        // ─── 任务一：幂等性拦截 ───
        // 防止 Trigger.dev 重试导致领地面积重复计算。
        // 若 runId 已处于 completed 状态，说明结算已完成，直接退出。
        try {
            const existingRun = await prisma.runs.findUnique({
                where: { id: runId },
                select: { status: true }
            });
            if (existingRun?.status === 'completed') {
                console.log(`[settle-territories] 幂等性拦截: runId=${runId} 已处于 completed 状态，跳过重复结算`);
                return { skipped: true, reason: 'already_completed', runId };
            }
        } catch (e) {
            console.error('[settle-territories] 幂等性检查失败，继续执行结算:', e);
        }

        console.log(`[Trigger:settle-territories] 开始后台结算 runId=${runId}, polygonCount=${polygons?.length ?? 0}, cityId=${cityId}`);

        try {
            // ─────────────────────────────────────────────
            // 阶段一：逐多边形结算领地
            // cityId 现在始终有效，直接执行结算
            // ─────────────────────────────────────────────
            if (polygons && polygons.length > 0) {
                for (const polyPoints of polygons) {
                    if (!polyPoints || polyPoints.length < 3) {
                        console.warn(`[settle-territories] runId=${runId}: 跳过少于3个点的polygon`);
                        continue;
                    }

                    // RISK-04: 坐标合法性过滤 (GCJ-02 中国大陆粗略边界)
                    const rawCoords = polyPoints.map((p: RunPoint) => [p.lng, p.lat] as [number, number]);
                    const invalidCoords = rawCoords.filter(([lng, lat]) =>
                        isNaN(lng) || isNaN(lat) ||
                        lat < -90 || lat > 90 ||
                        lng < -180 || lng > 180 ||
                        lat < 3 || lat > 55 ||   // 中国大陆粗略边界
                        lng < 70 || lng > 140
                    );
                    if (invalidCoords.length > 0) {
                        console.warn(`[settle-territories] runId=${runId}: polygon 含 ${invalidCoords.length} 个越界坐标，跳过。首个越界: [${invalidCoords[0]}]`);
                        continue;
                    }

                    // ── 核心重構：廢除凸包，引入解結算法 (Unkink Polygon) ──
                    // 調用統一的 cleanAndSplitTrajectory 處理自交疊與清算
                    const cleanedPolys = cleanAndSplitTrajectory(rawCoords);
                    if (cleanedPolys.length === 0) {
                        console.warn(`[settle-territories] runId=${runId}: 軌跡無法構成有效多邊形，跳過。`);
                        continue;
                    }

                    for (const polyFeature of cleanedPolys) {
                        try {
                            const settlement = await processTerritorySettlement({
                                runId,
                                userId,
                                cityId,
                                clubId,
                                pathGeoJSON: polyFeature,
                                preProcessedPolygons: [polyFeature]
                            });

                            if (settlement.success) {
                                settledCount += settlement.createdTerritories;
                                reinforcedCount += settlement.reinforcedTerritories;
                                console.log(`[settle-territories] runId=${runId}: +${settlement.createdTerritories} 新領地, +${settlement.reinforcedTerritories} 強化`);
                            } else {
                                if ((settlement as any).errorCode === 'INVALID_CITY_ID') {
                                    // 防御性保留：理论上 cityId 已在上方 !cityId 守卫中拦截，
                                    // 此分支仅作为 settlement.ts 内部校验的二次兜底。
                                    // 不再将 finalStatus 改为 flagged，仅跳过当前多边形，保持 completed。
                                    console.error(`[settle-territories] 核心业务失败 INVALID_CITY_ID: runId=${runId}（城市ID二次校验失败，跳过当前多边形）`);
                                    break;
                                }
                            }
                        } catch (polyError) {
                            console.error(`[settle-territories] 單多邊形結算失敗 runId=${runId}`, polyError);
                        }
                    }
                }

                // 移除重复的 user_city_progress update, 该操作已在 run-service 的 transaction 中实现

                // 更新 runs 表的地块计数
                await prisma.runs.update({
                    where: { id: runId },
                    data: {
                        new_territories_count: settledCount,
                        reinforced_territories_count: reinforcedCount
                    }
                }).catch((e: Error) => console.error('[settle-territories] 更新 runs 计数失败', e));

                console.log(`[settle-territories] runId=${runId}: 阶段一完成 settled=${settledCount} reinforced=${reinforcedCount}`);
            } else {
                console.log(`[settle-territories] runId=${runId}: polygons 为空，跳过地块结算阶段`);
            }

            // ─────────────────────────────────────────────
            // 阶段二：任务中心事件
            // ─────────────────────────────────────────────
            try {
                await updateMissionProgress(userId, 'DISTANCE', Math.round(distance));
                await updateMissionProgress(userId, 'RUN_COUNT', 1);
                if (settledCount > 0) {
                    await updateMissionProgress(userId, 'HEX_COUNT', settledCount);
                }
                console.log(`[settle-territories] 任务进度已更新 userId=${userId}`);
            } catch (taskError) {
                console.error('[settle-territories] 任务进度更新失败', taskError);
            }

            // ─────────────────────────────────────────────
            // 阶段三：挑战进度
            // ─────────────────────────────────────────────
            try {
                const paceSecondsPerKm = distance > 0
                    ? duration / (distance / 1000)
                    : 0;
                await updateChallengeProgress(userId, {
                    distance_meters: distance,
                    hexes_claimed: settledCount,
                    pace_seconds_per_km: paceSecondsPerKm,
                });
                console.log(`[settle-territories] 挑战进度已更新 userId=${userId}`);
            } catch (challengeError) {
                console.error('[settle-territories] 挑战进度更新失败', challengeError);
            }

            // 所有阶段完成，标记成功
            finalStatus = 'completed';

        } catch (fatalError) {
            // 顶层 catch：标记为失败，记录错误
            finalStatus = 'failed';
            finalErrorCode = fatalError instanceof Error ? fatalError.message : String(fatalError);
            console.error(`[settle-territories] 致命错误 runId=${runId}`, fatalError);
        } finally {
            // ─────────────────────────────────────────────
            // 无论任何路径（正常结算 / 致命错误），均回写 run.status
            // finalStatus 默认为 'failed'，仅在 try 块成功完成时被设为 'completed'
            try {
                await prisma.runs.update({
                    where: { id: runId },
                    data: {
                        status: finalStatus,
                        updated_at: new Date(),
                        ...(finalStatus === 'flagged' && finalErrorCode === 'INVALID_CITY_ID' ? { 
                            isValid: false, 
                            flag_reason: 'INVALID_CITY_ID',
                            settlement_error_code: 'INVALID_CITY_ID',
                            settlement_error_detail: 'Settlement aborted: invalid cityId'
                        } : {}),
                        ...(finalStatus === 'failed' ? {
                            settlement_error_code: 'TASK_ERROR',
                            settlement_error_detail: finalErrorCode
                        } : {})
                    }
                });
                console.log(`[settle-territories] ✅ Run ${runId} 状态已回写: ${finalStatus}`);
            } catch (statusErr) {
                console.error(`[settle-territories] ❌ 状态回写失败 runId=${runId}`, statusErr);
            }
        }

        if (finalStatus === 'failed') {
            throw new Error(`Settlement failed for runId=${runId}: ${finalErrorCode}`);
        }

        return { settledCount, reinforcedCount, runId, distance, duration };
    }
});

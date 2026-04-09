import { task } from "@trigger.dev/sdk";
import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { processTerritorySettlement } from "@/lib/territory/settlement";
import { prisma } from "@/lib/prisma";
import { TaskService } from "@/lib/services/task";
import { updateChallengeProgress } from "@/app/actions/challenge-service";

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
 */
export const settleTerritoriesTask = task({
    id: "settle-territories",
    maxDuration: 600, // 10 分钟超时，应对大量重叠领地场景
    run: async (payload: {
        runId: string;
        userId: string;
        cityId: string;
        clubId: string | null;
        polygons: RunPoint[][];
        distance: number;
        duration: number;
    }) => {
        const { runId, userId, cityId, clubId, polygons, distance, duration } = payload;
        let settledCount = 0;
        let reinforcedCount = 0;

        console.log(`[Trigger:settle-territories] 开始后台结算 runId=${runId}, polygonCount=${polygons?.length ?? 0}`);

        try {
            // ─────────────────────────────────────────────
            // 阶段一：逐多边形结算领地
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

                    // ── 核心修复：凸包替代 turf.polygon([coords]) ──
                    // turf.polygon 直接接受原始 GPS 序列时，若轨迹交叉会产生自交叠（蜘蛛网）。
                    // turf.convex 从点云求凸包，保证输出为合法的无自交简单多边形。
                    const pointCollection = turf.featureCollection(
                        rawCoords.map(([lng, lat]: [number, number]) => turf.point([lng, lat]))
                    );
                    const hull = turf.convex(pointCollection);
                    if (!hull) {
                        // 共线点集（面积为零），无法构成合法多边形，跳过
                        console.warn(`[settle-territories] runId=${runId}: 凸包退化（共线点集），跳过该polygon`);
                        continue;
                    }
                    const polyFeature = hull as Feature<Polygon>;

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
                            console.log(`[settle-territories] runId=${runId}: +${settlement.createdTerritories} 新领地, +${settlement.reinforcedTerritories} 强化`);
                        }
                    } catch (polyError) {
                        // 单个多边形结算失败不应中断整体任务
                        console.error(`[settle-territories] 单polygon结算失败 runId=${runId}`, polyError);
                    }
                }

                // 更新 tiles_captured 计数
                if (settledCount > 0) {
                    await prisma.user_city_progress.update({
                        where: { user_id_city_id: { user_id: userId, city_id: cityId } },
                        data: { tiles_captured: { increment: settledCount } }
                    }).catch((e: Error) => console.error('[settle-territories] 更新 tiles_captured 失败', e));
                }

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
                const eventPayload = {
                    type: 'RUN_FINISHED' as const,
                    userId,
                    timestamp: new Date(),
                    data: {
                        distance,
                        duration,
                        pace: distance > 0 ? (duration / (distance / 1000)) : 0,
                    }
                };
                await TaskService.processEvent(userId, eventPayload);
                console.log(`[settle-territories] 任务中心事件已处理 userId=${userId}`);
            } catch (taskError) {
                console.error('[settle-territories] 任务中心事件处理失败', taskError);
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

        } catch (fatalError) {
            // 顶层 catch：记录致命错误但不阻止 finally 中的状态回写
            console.error(`[settle-territories] 致命错误 runId=${runId}`, fatalError);
        } finally {
            // ─────────────────────────────────────────────
            // RISK-02 强制状态回写（绝对执行）
            // 无论结算成功、失败、还是 polygons 为空，
            // 必须将 runs.status 标记为 'completed'，
            // 以解除前端 RunSummaryView 的轮询死锁。
            // ─────────────────────────────────────────────
            try {
                await prisma.runs.update({
                    where: { id: runId },
                    data: {
                        status: 'completed',
                        updated_at: new Date(),
                    }
                });
                console.log(`[settle-territories] ✅ Run ${runId} 状态已标记为 completed`);
            } catch (statusErr) {
                console.error(`[settle-territories] ❌ 状态回写失败 runId=${runId}`, statusErr);
            }
        }

        return { settledCount, reinforcedCount, runId, distance, duration };
    }
});

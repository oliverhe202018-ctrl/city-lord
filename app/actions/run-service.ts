'use server';

import { prisma } from '@/lib/prisma';
import { evaluateTasks, RunData, TaskResult } from '@/lib/game/task-engine';
import { revalidatePath, revalidateTag, unstable_noStore as noStore } from 'next/cache';
import { tasks } from "@trigger.dev/sdk/v3";
import { RunRecordDTO, ActionResponse, RunEventLog } from '@/types/run-sync';
import { validateRunAndRebuildTerritories, AntiCheatValidationResult } from '@/lib/anti-cheat/territory-builder';
import { checkRunRateLimit } from '@/lib/anti-cheat/rate-limiter';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import { validateRunData } from '@/lib/validators/run-validator';
import { validateRunLegitimacy } from '@/lib/anti-cheat/mvp-rules';
import {
    lineString as turfLineString,
    simplify as turfSimplify,
    polygon as turfPolygon,
    unkinkPolygon as turfUnkinkPolygon,
    area as turfArea,
    bbox as turfBbox,
    intersect as turfIntersect,
    featureCollection as turfFeatureCollection,
    union as turfUnion,
    length as turfLength,
} from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { cleanAndSplitTrajectory } from '@/lib/gis/geometry-cleaner';
import { isLoopClosed, LOOP_CLOSURE_THRESHOLD_M, extractValidLoops, type Coord } from '@/lib/geometry-utils';
import { isTester } from '@/lib/constants/anti-cheat';

// 用 Ramer-Douglas-Peucker 保留关键几何节点，不破坏环路

function haversineDistance(
  [lng1, lat1]: [number, number],
  [lng2, lat2]: [number, number]
): number {
  const R = 6371000; // 地球半径，单位：米
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function rdpSamplePath(points: any[], maxPoints: number): any[] {
    if (points.length <= maxPoints) return points;
    const line = turfLineString(points.map((p: any) => [p.lng, p.lat]));
    // 容差从小到大自动收敛，直到点数满足要求
    let tolerance = 0.00001;
    let simplified = points;
    while (simplified.length > maxPoints && tolerance < 0.01) {
        const result = turfSimplify(line, { tolerance, highQuality: false });
        simplified = result.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
        tolerance *= 2;
    }
    return simplified;
}

export interface SaveRunResult {
    runId?: string;
    runNumber?: number;
    newTasks?: TaskResult[];
    totalReward?: { coins: number; xp: number };
    damageSummary?: any[];
    maintenanceSummary?: any[];
    settledTerritoriesCount?: number;
    isValid?: boolean;
    antiCheatLog?: string | null;
    totalSteps?: number;
    settlingAsync?: boolean;
}

const isRunEventLog = (event: unknown): event is RunEventLog => {
    if (!event || typeof event !== 'object') return false;
    const value = event as Partial<RunEventLog>;
    return Boolean(
        typeof value.eventId === 'string' &&
        (value.eventType === 'CHASE' || value.eventType === 'ENERGY_SURGE') &&
        (value.status === 'SUCCESS' || value.status === 'FAILED') &&
        typeof value.triggeredAt === 'number' &&
        typeof value.resolvedAt === 'number'
    );
};

const getDefaultEventReward = (eventType: RunEventLog['eventType']) => {
    if (eventType === 'CHASE') return { xp: 50, stamina: 0 };
    return { xp: 30, stamina: 5 };
};

const PEDOMETER_STRICT_DISTANCE_METERS = 500;
const PEDOMETER_MIN_STEPS = 100;
const PEDOMETER_MAX_STRIDE_METERS = 1.5;


/**
 * Saves a run and evaluates/grants task rewards atomically.
 * Idempotency is verified via Validated UserTaskLog checks.
 */
export async function saveRunActivity(
    userId: string,
    runData: RunRecordDTO,
    clubId?: string | null
): Promise<ActionResponse<SaveRunResult>> {
    console.log(`[Territory-Diag-Init] saveRunActivity 被调用，当前时间戳: ${Date.now()}`);
    try {
        if (!userId) throw new Error('User ID is required');
        const eventsHistory = Array.isArray(runData.eventsHistory)
            ? runData.eventsHistory.filter(isRunEventLog)
            : [];
        const submittedTotalSteps = Math.max(0, Math.floor(Number(runData.totalSteps ?? runData.steps ?? 0)));
        let runnerClubId = clubId ?? runData.clubId ?? null;
        if (!runnerClubId && userId) {
            try {
                const profile = await prisma.profiles.findUnique({
                    where: { id: userId },
                    select: { club_id: true }
                });
                runnerClubId = profile?.club_id ?? null;
            } catch (e) {
                console.warn('[runnerClubId] Failed to fetch from DB:', e);
            }
        }

        // Rate Limiting
        const rateLimitResult = checkRunRateLimit(userId);
        if (!rateLimitResult.allowed) {
            console.warn(`[saveRunActivity] Rate limit exceeded for user: ${userId}`);
            return {
                success: false,
                error: `Too many submissions. Please try again in ${rateLimitResult.retryAfter} seconds.`
            };
        }

        // 0. Strong Idempotency Check
        if (runData.idempotencyKey) {
            const existingRun = await prisma.runs.findUnique({
                where: { idempotency_key: runData.idempotencyKey }
            });
            if (existingRun) {
                console.log(`[saveRunActivity] Idempotent replay blocked for key: ${runData.idempotencyKey}`);
                return {
                    success: true,
                    message: "Run already processed securely.",
                    data: { runId: existingRun.id }
                };
            }
        }
        
        // --- GIS-01: 強制降維採樣 (Path Simplification) ---
        // 應對 15000+ GPS 點導致的性能崩潰。在處理業務邏輯前，先行極速壓縮。
        const rawPathPointsForGIS = (runData.path as any[]) || [];
        if (rawPathPointsForGIS.length > 500) {
            const line = turfLineString(rawPathPointsForGIS.map((p: any) => [p.lng, p.lat]));
            // 0.0001 容差約為 10 米，能過濾大量抖動並極速壓縮點雲
            const simplified = turfSimplify(line, { tolerance: 0.0001, highQuality: false });
            
            // 保持 Location[] 類型兼容性，簡單帶上時間戳
            const startTime = rawPathPointsForGIS[0]?.timestamp || Date.now();
            const endTime = rawPathPointsForGIS[rawPathPointsForGIS.length - 1]?.timestamp || Date.now();
            const count = simplified.geometry.coordinates.length;
            
            runData.path = simplified.geometry.coordinates.map(([lng, lat]: any, idx: number) => ({ 
                lat, 
                lng,
                // 基於點順序大致模擬時間分佈
                timestamp: Math.floor(startTime + (endTime - startTime) * (idx / Math.max(1, count - 1)))
            }));
            console.log(`[GIS] Path simplified from ${rawPathPointsForGIS.length} to ${runData.path.length} points.`);
        }

        // --- P0 Anti-Cheat MVP Validation ---
        const pathPoints = (runData.path as any[]) || [];
        const legitimacyCheck = validateRunLegitimacy({
            distanceKm: runData.distance / 1000,
            durationSeconds: runData.duration,
            pathPointsCount: pathPoints.length
        });

        // [God Mode] Bypass P0 legit check for white-listed testers
        const isUserTester = isTester(userId);
        if (isUserTester) {
            (legitimacyCheck as any).isValid = true;
            console.log(`[God Mode] P0 Legitimacy check bypassed for tester: ${userId}`);
        }

        if (!legitimacyCheck.isValid) {
            console.warn(`[Anti-Cheat MVP] Run blocked for user ${userId}. Reason: ${legitimacyCheck.reason}`);
            
            // Log the cheat attempt independently of the main transaction
            await prisma.anti_cheat_audit_logs.create({
                data: {
                    user_id: userId,
                    risk_score: 100, // Blocking offense
                    cheat_flags: { mvp_reason: legitimacyCheck.reason },
                    raw_payload: runData as any,
                    action_taken: 'BLOCKED_SETTLEMENT'
                }
            });

            return {
                success: false,
                error: "检测到数据异常，可能使用了交通工具，本次跑步无法作为有效占领记录。"
            };
        }
        // ------------------------------------

        // 1. Metadata-based Anti-Cheat check (Speed, Stride, Teleportation)
        const metadataValidation = validateRunData({
            distanceMeters: runData.distance,
            durationSeconds: runData.duration,
            steps: submittedTotalSteps
        });

        // 2. Server-Side Path Analysis & Territory Rebuild (Existing Logic)
        const pathValidation: AntiCheatValidationResult = validateRunAndRebuildTerritories(runData.path as any);

        let pedometerAntiCheatLog: string | null = null;
        if (runData.distance > PEDOMETER_STRICT_DISTANCE_METERS) {
            if (submittedTotalSteps < PEDOMETER_MIN_STEPS) {
                pedometerAntiCheatLog = 'STEP_TOO_LOW';
            } else {
                const strideLength = runData.distance / submittedTotalSteps;
                if (strideLength > PEDOMETER_MAX_STRIDE_METERS) {
                    pedometerAntiCheatLog = 'STRIDE_TOO_LONG';
                }
            }
        }

        // Combined risk assessment
        let isFlagged = metadataValidation.isFlagged || pathValidation.riskLevel === 'HIGH';
        let isPedometerInvalid = pedometerAntiCheatLog !== null;

        // 任务二: Tester 权限覆盖 — 强制将 effectiveRiskLevel 降为 LOW
        // 防止 MEDIUM 虚拟定位风险在后续管道中清空多边形数组
        let effectiveRiskLevel = pathValidation.riskLevel;

        if (isUserTester) {
            isFlagged = false;
            isPedometerInvalid = false;
            pedometerAntiCheatLog = null;
            effectiveRiskLevel = 'LOW'; // 强制豁免高虚拟定位风险
            console.log(`[God Mode] effectiveRiskLevel forced to LOW for tester: ${userId}`);
        }

        const isBlockedByAntiCheat = isFlagged || isPedometerInvalid;
        const flagReason = metadataValidation.flagReason || (effectiveRiskLevel === 'HIGH' ? 'PATH_ANALYSIS_FAILED' : undefined);

        // 2. 轨迹采样降维 (防 O(N²) 爆算)
        const MAX_SERVER_PATH_POINTS = 600;
        const rawPathPoints = (runData.path as any[]) || [];
        const sampledPath = rdpSamplePath(rawPathPoints, MAX_SERVER_PATH_POINTS);

        // 3. 闭合检测与领地初步提取 (Rule 1 & Rule 2)
        let finalPolygons: Coord[][] = [];
        const sampledPointsLngLat = sampledPath.map(p => [p.lng, p.lat] as [number, number]);
        console.log('[闭合检测] sampledPath 点数:', sampledPointsLngLat.length);
        console.log(`[Territory-Diag] 轨迹总点数: ${sampledPointsLngLat.length}, 总距离: ${runData.distance}m`);

        if (sampledPointsLngLat.length >= 3) {
            const lastPoint = sampledPointsLngLat[sampledPointsLngLat.length - 1];
            const firstPoint = sampledPointsLngLat[0];
            
            let closingPath: [number, number][] | null = null;

            // 规则一：全局首尾闭合 (20米)
            const distGlobal = haversineDistance(lastPoint, firstPoint);
            console.log('[规则一] 首尾距离(米):', distGlobal);
            console.log(`[Territory-Diag] 规则一测算 - 首尾物理距离: ${distGlobal}m (阈值30m)`);

            if (distGlobal <= 20) {
                closingPath = [...sampledPointsLngLat];
            } else {
                // 规则二：局部交叉闭合 (从起点到 L-20 遍历，寻找与终点 10米内的交叉点)
                let bestIndex = -1;
                let minDist = 11; // 初始化大于 10

                for (let i = 0; i <= sampledPointsLngLat.length - 20; i++) {
                    const d = haversineDistance(lastPoint, sampledPointsLngLat[i]);
                    if (d <= 10 && d < minDist) {
                        minDist = d;
                        bestIndex = i;
                    }
                }
                if (bestIndex !== -1) { console.log(`[Territory-Diag] 规则二命中 - 发现交叉点，索引: ${bestIndex}, 交叉距离: ${minDist}m`); } else { console.log(`[Territory-Diag] 规则二未命中 - 遍历 L-${sampledPointsLngLat.length-20} 未发现 15m 内交叉点`); }
                console.log('[规则二] bestIndex:', bestIndex, '最近距离(米):', minDist);


                if (bestIndex !== -1) {
                    closingPath = sampledPointsLngLat.slice(bestIndex);
                }
            }
            console.log('[闭合结果] closingPath 长度:', closingPath ? closingPath.length : 'null');


            // 生成最终多边形环
            if (closingPath && closingPath.length >= 3) {
                const ring = [...closingPath];
                // 安全闭合：强制首尾点一致
                const first = ring[0];
                const last = ring[ring.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    ring.push([first[0], first[1]]);
                }
                // 转换回 Coord[] 格式
                finalPolygons = [ring.map(([lng, lat]) => ({ lng, lat }))];
                console.log('[多边形] finalPolygons 长度:', finalPolygons.length);

            }
            if (finalPolygons.length === 0) { console.log(`[Territory-Diag] 警告: 闭合条件均未满足，多边形提取被废弃。`); }
        }

        // Settlement Gating — 使用 effectiveRiskLevel 代替原始 pathValidation.riskLevel
        if (isBlockedByAntiCheat) {
            finalPolygons = [];
            console.warn(`[Anti-Cheat] Settlement blocked for user ${userId}. Reason: ${flagReason ?? pedometerAntiCheatLog}`);
        } else if (effectiveRiskLevel === 'MEDIUM' && !isUserTester) {
            finalPolygons = [];
            console.log(`[saveRunActivity] MEDIUM risk run. Polygons neutralized for user: ${userId}`);
        }

        // 4. 大圈吞噬小圈核心算法 (BBox 加速) - 使用 Unkink 解結算法替代 Convex Hull
        function deduplicateByContainment(polygons: any[]): any[] {
            if (polygons.length <= 1) return polygons;

            const withData = polygons.flatMap(polyPts => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
                
                try {
                    // FIX: 廢除凸包，引入解結算法 (Unkink Polygon)
                    // 確保能精確還原 U 型彎、折返路，而不是拉一個包裹所有點的大框
                    if (coords.length < 3) return [];
                    const ring = [...coords];
                    if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
                        ring.push([...ring[0]]);
                    }
                    if (ring.length < 4) return [];
                    
                    const rawPoly = turfPolygon([ring]);
                    const unkinked = turfUnkinkPolygon(rawPoly);
                    
                    // 任务二 (GIS 溢出修复): 双重硬性拦截——等周率 + 绝对面积上限
                    const MIN_ISO_RATIO = 0.003;
                    const MAX_TERRITORY_AREA_M2 = 200_000;
                    return unkinked.features
                        .filter((f: any) => {
                            const area = turfArea(f);
                            if (area <= 50) return false;
                            if (area > MAX_TERRITORY_AREA_M2) return false;
                            try {
                                const perimeterM = turfLength(f) * 1000;
                                if (perimeterM <= 0) return false;
                                const isoRatio = (4 * Math.PI * area) / (perimeterM * perimeterM);
                                if (isoRatio < MIN_ISO_RATIO) return false;
                            } catch { return false; }
                            return true;
                        })
                        .map((f: any) => ({
                            original: polyPts,
                            f: f as Feature<Polygon>,
                            area: turfArea(f),
                            bbox: turfBbox(f)
                        }));
                } catch (e) {
                    console.warn('[GIS] Failed to unkink polygon during deduplication:', e);
                    return [];
                }
            });

            // 优化1：按面積降序排列
            const sorted = withData.sort((a, b) => b.area - a.area);

            const survivors: typeof sorted = [];
            for (const candidate of sorted) {
                let isContained = false;
                for (const big of survivors) {
                    // 优化2：BBox (包围盒) 快速拒绝
                    if (
                        candidate.bbox[0] >= big.bbox[0] && candidate.bbox[1] >= big.bbox[1] &&
                        candidate.bbox[2] <= big.bbox[2] && candidate.bbox[3] <= big.bbox[3]
                    ) {
                        // 优化3：计算重叠
                        try {
                            const intersection = turfIntersect(turfFeatureCollection([big.f, candidate.f]));
                            if (intersection) {
                                const overlapRatio = turfArea(intersection) / candidate.area;
                                if (overlapRatio > 0.90) {
                                    isContained = true;
                                    break;
                                }
                            }
                        } catch (e) { /* skip */ }
                    }
                }
                if (!isContained) survivors.push(candidate);
            }
            // 返回原始路徑點
            return survivors.map(s => s.original);
        }

        const polygonsForSettlement = (isBlockedByAntiCheat || (effectiveRiskLevel === 'MEDIUM' && !isUserTester)) ? [] : deduplicateByContainment(finalPolygons);

        // 5. 直接在内存中累加真实占领的领地面积 - 使用 Unkink 替代 Convex
        let accurateAreaKm2 = 0;
        if (polygonsForSettlement.length > 0) {
            const validPolys: Feature<Polygon>[] = [];
            polygonsForSettlement.forEach((polyPts) => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
                try {
                    if (coords.length >= 3) {
                        const ring = [...coords];
                        if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
                            ring.push([...ring[0]]);
                        }
                        if (ring.length < 4) return;
                        
                        const rawPoly = turfPolygon([ring]);
                        const unkinked = turfUnkinkPolygon(rawPoly);
                        unkinked.features.forEach((f: any) => {
                            const area = turfArea(f);
                            if (area <= 50) return;
                            if (area > 200_000) return; // MAX_TERRITORY_AREA_M2 硬拦截
                            try {
                                const perimeterM = turfLength(f) * 1000;
                                if (perimeterM > 0) {
                                    const isoRatio = (4 * Math.PI * area) / (perimeterM * perimeterM);
                                    if (isoRatio < 0.003) return;
                                }
                            } catch { /* 无法计算时保留 */ }
                            validPolys.push(f as Feature<Polygon>);
                        });
                    }
                } catch (e) {
                    console.warn('[GIS] accurateAreaKm2 unkink failed:', e);
                }
            });

            if (validPolys.length > 0) {
                try {
                    let merged = validPolys[0] as Feature<Polygon | MultiPolygon>;
                    for (let i = 1; i < validPolys.length; i++) {
                        const combined = turfUnion(turfFeatureCollection([merged, validPolys[i]]));
                        if (combined) {
                            merged = combined as Feature<Polygon | MultiPolygon>;
                        }
                    }
                    accurateAreaKm2 = turfArea(merged) / 1000000;
                } catch (e) {
                    console.error('[GIS] Final union for area calculation failed:', e);
                }
            }
        }

        // 3. Prepare Run Data for Evaluation
        const evaluationData: RunData = {
            distance: pathValidation.serverDistance,
            duration: pathValidation.serverDuration,
            claims: finalPolygons, // Server-calculated claims
            timestamp: new Date(runData.timestamp || Date.now()),
        };

        // 4. Evaluate Tasks (In-Memory)
        // If flagged, we skip rewards by setting results to empty
        const potentialResults = (isBlockedByAntiCheat || effectiveRiskLevel === 'HIGH') ? [] : evaluateTasks(evaluationData);

        // 5. Transaction: Save Run + Process Rewards + Audit Logs
        const result = await prisma.$transaction(async (tx: any) => {
            // A. Create Run Record (Always saved, even if flagged)
            const run = await tx.runs.create({
                data: {
                    user_id: userId,
                    distance: evaluationData.distance,
                    duration: evaluationData.duration,
                    path: runData.path as any,
                    polygons: evaluationData.claims as any,
                    status: isBlockedByAntiCheat ? 'flagged' : 'settling',
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Anti-Cheat Fields
                    risk_score: isUserTester ? 0 : pathValidation.riskScore,
                    risk_level: isUserTester ? 'LOW' : pathValidation.riskLevel,
                    cheat_flags: {
                        ...(pathValidation.cheatFlags as any),
                        ...(isUserTester ? { tester_bypass: true } : {})
                    } as any,
                    client_distance: runData.distance,
                    // New Validator Fields
                    is_flagged: isUserTester ? false : isFlagged,
                    flag_reason: isUserTester ? null : flagReason,
                    eventsLog: eventsHistory as any,
                    totalSteps: submittedTotalSteps,
                    isValid: isUserTester ? true : !isPedometerInvalid,
                    antiCheatLog: isUserTester ? null : pedometerAntiCheatLog,
                },
            });

            // Audit logging for suspicious runs
            if (isBlockedByAntiCheat || pathValidation.riskLevel !== 'LOW') {
                await tx.anti_cheat_audit_logs.create({
                    data: {
                        user_id: userId,
                        run_id: run.id,
                        risk_score: isPedometerInvalid ? Math.max(pathValidation.riskScore, 90) : pathValidation.riskScore,
                        cheat_flags: {
                            ...(pathValidation.cheatFlags as any),
                            pedometer_reason: pedometerAntiCheatLog
                        } as any,
                        raw_payload: runData as any,
                        action_taken: isPedometerInvalid ? 'pedometer_blocked' : (isFlagged ? 'shadowban' : 'polygons_neutralized'),
                    }
                });
            }

            if (isBlockedByAntiCheat) {
                // 任务三: 强制 isValid: false 消灭静默失败
                // 前端 UI 可据此检测到拦截并弹出具体提示
                return {
                    runId: run.id,
                    runNumber: 0,
                    newTasks: [],
                    rewards: { coins: 0, xp: 0 },
                    isValid: false, // 必须为 false，杜绝静默通过
                    antiCheatLog: pedometerAntiCheatLog ?? 'BLOCKED_BY_ANTICHEAT_PATH_RISK',
                    totalSteps: submittedTotalSteps,
                    isFlagged: true
                };
            }

            // B. Filter Tasks (Idempotency Check)
            const newTasks: TaskResult[] = [];
            let totalCoins = 0;
            let totalXp = 0;
            
            // ... (Rest of existing reward and settlement logic)

            if (potentialResults.length > 0) {
                // Find existing logs for these specific tasks & periods to prevent duplicates
                // We construct an OR query for all potential completions
                const checks = potentialResults.map(r => ({
                    user_id: userId,
                    task_id: r.taskId,
                    period_key: r.periodKey
                }));

                const existingLogs = await tx.user_task_logs.findMany({
                    where: {
                        OR: checks
                    },
                    select: {
                        task_id: true,
                        period_key: true
                    }
                });

                const existingSet = new Set(
                    existingLogs.map((l: any) => `${l.task_id}-${l.period_key}`)
                );

                // Process only NEW completions
                for (const res of potentialResults) {
                    const key = `${res.taskId}-${res.periodKey}`;
                    if (!existingSet.has(key)) {
                        // Valid new completion
                        await tx.user_task_logs.create({
                            data: {
                                user_id: userId,
                                run_id: run.id,
                                task_id: res.taskId,
                                type: res.type,
                                period_key: res.periodKey,
                                reward_coins: res.reward,
                                reward_xp: 0, // TODO: 当 XP 奖励系统上线后，此处需接入真实的 XP 计算逻辑
                                completed_at: new Date(),
                            }
                        });

                        newTasks.push(res);
                        totalCoins += res.reward;
                        // totalXp += res.rewardXp; // If we had separate XP in helper
                    }
                }
            }

            const successfulEvents = eventsHistory.filter(event => event.status === 'SUCCESS');
            const failedEvents = eventsHistory.filter(event => event.status === 'FAILED');
            const hasFailureEvent = failedEvents.length > 0;
            const penaltyMultiplier = hasFailureEvent
                ? Math.min(...failedEvents.map(event => event.penaltyMultiplier ?? 0.5))
                : 1;

            const eventReward = successfulEvents.reduce(
                (acc, event) => {
                    const defaults = getDefaultEventReward(event.eventType);
                    acc.xp += event.reward?.xp ?? defaults.xp;
                    acc.stamina += event.reward?.stamina ?? defaults.stamina;
                    return acc;
                },
                { xp: 0, stamina: 0 }
            );

            totalCoins = Math.floor(totalCoins * penaltyMultiplier);
            totalXp = Math.floor(totalXp * penaltyMultiplier) + eventReward.xp;

            // C. Get Run Number
            const runNumber = await tx.runs.count({
                where: { user_id: userId }
            });

            // D. Update City Progress — accurateAreaKm2 pre-computed outside tx
            if (!isFlagged) {
                const cityId = (runData as any).cityId || "default_city";

                await tx.user_city_progress.upsert({
                    where: {
                        user_id_city_id: {
                            user_id: userId,
                            city_id: cityId
                        }
                    },
                    update: {
                        area_controlled: { increment: accurateAreaKm2 },
                        last_active_at: new Date()
                    },
                    create: {
                        user_id: userId,
                        city_id: cityId,
                        area_controlled: accurateAreaKm2,
                        tiles_captured: 0, // 数量会在微事务中补充
                        last_active_at: new Date(),
                        joined_at: new Date()
                    }
                });

                // Update Profile Stats
                const updatedProfile = await tx.profiles.update({
                    where: { id: userId },
                    data: {
                        coins: { increment: totalCoins },
                        xp: { increment: totalXp },
                        stamina: { increment: eventReward.stamina },
                        total_distance_km: { increment: evaluationData.distance / 1000 },
                        total_area: { increment: accurateAreaKm2 },
                        total_runs_count: { increment: 1 },
                        updated_at: new Date()
                    }
                });

                return {
                    runId: run.id,
                    runNumber: updatedProfile.total_runs_count,
                    newTasks,
                    rewards: { coins: totalCoins, xp: totalXp },
                    isValid: true,
                    antiCheatLog: null,
                    totalSteps: submittedTotalSteps,
                    isFlagged: false
                };
            }

            return {
                runId: run.id,
                runNumber: 0,
                newTasks,
                rewards: { coins: totalCoins, xp: totalXp },
                isValid: true,
                antiCheatLog: null,
                totalSteps: submittedTotalSteps,
                isFlagged: true
            };
        }, { timeout: 30000, maxWait: 10000 });

        // Phase 3: 主事务外部异步结算领地与附属数据更新 (Trigger.dev 核心解耦)
        if (!isBlockedByAntiCheat) {
            const cityId = (runData as any).cityId || 'default_city';
            
            try {
                const triggerPayload = {
                    runId: result.runId,
                    userId,
                    cityId,
                    clubId: runnerClubId,
                    polygons: polygonsForSettlement,
                    distance: evaluationData.distance,
                    duration: evaluationData.duration
                };
                console.log(`[Trigger.dev] Enqueuing 'settle-territories'. polygonCount=${polygonsForSettlement.length}, runId=${result.runId}`);
                console.log(`[Trigger.dev] payload: ${JSON.stringify({ runId: triggerPayload.runId, userId: triggerPayload.userId, cityId: triggerPayload.cityId, polygonCount: triggerPayload.polygons.length })}`);
                const handle = await tasks.trigger("settle-territories", triggerPayload);
                console.log(`[Territory-Diag-Trigger] 任务已推入队列，随机校验码: ${Math.random()}`);
                if (!handle || !(handle as any)?.id) {
                    throw new Error(`[Trigger.dev] tasks.trigger returned invalid handle (null/undefined id) for runId=${result.runId}`);
                }
                console.log(`[Trigger.dev] ✅ Task enqueued. Handle: ${(handle as any).id}`);
            } catch (err: any) {
                console.error(`[Trigger.dev] ❌ FAILED to enqueue 'settle-territories': ${err?.message ?? err}`);
                console.error(`[Trigger.dev] Full error:`, err);
                // 错误隔离：只打印日志，绝不向上抛出，主流程继续正常返回
            }
        }

        revalidatePath('/dashboard');
        revalidatePath('/profile/me');
        revalidateTag('territories');
        revalidateTag('city-stats');
        revalidateTag('city-leaderboard');

        return {
            success: true,
            data: {
                runId: result.runId,
                runNumber: result.runNumber,
                newTasks: result.newTasks,
                totalReward: result.rewards,
                damageSummary: [],
                maintenanceSummary: [],
                settledTerritoriesCount: 0,
                isValid: result.isValid,
                antiCheatLog: result.antiCheatLog,
                totalSteps: result.totalSteps,
                settlingAsync: (!result.isFlagged && polygonsForSettlement.length > 0) ? true : undefined
            }
        };

    } catch (error: any) {
        console.error('Failed to save run:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Updates the AI summary for a specific run record.
 */
export async function updateRunSummary(runId: string, summary: string): Promise<ActionResponse<void>> {
    try {
        if (!runId || !summary) throw new Error('Run ID and summary are required');
        
        await prisma.runs.update({
            where: { id: runId },
            data: { aiSummary: summary }
        });

        console.log(`[RunService] AI Summary updated for run: ${runId}`);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update run summary:', error);
        return { success: false, error: error.message };
    }
}

export async function getRunSettlementStatus(runId: string): Promise<ActionResponse<{ newTerritories: number; reinforcedTerritories: number; isSettled: boolean } | null>> {
    // 任务三：强制禁用 Next.js 数据缓存，确保每次轮询都读取最新 run.status
    // 若不注入 noStore()，Next.js App Router 可能对 Server Action 响应做 full-route cache，
    // 导致 status 永远是首次缓存的 'settling'，前端陷入轮询死锁。
    noStore();
    try {
        if (!runId) throw new Error('Run ID is required');
        const runRec = await prisma.runs.findUnique({
            where: { id: runId },
            select: { new_territories_count: true, reinforced_territories_count: true, status: true, updated_at: true, created_at: true }
        });
        
        if (!runRec) {
            return { success: false, error: 'Run not found' };
        }
        
        // isSettled = true when Trigger.dev background task has finished and written
        // back the 'completed' (or 'flagged') status. This lets the frontend exit
        // the polling loop even when territory capture counts are legitimately 0.
        const isSettled = runRec.status === 'completed' || runRec.status === 'flagged';

        return {
            success: true,
            data: {
                newTerritories: runRec.new_territories_count || 0,
                reinforcedTerritories: runRec.reinforced_territories_count || 0,
                isSettled,
            }
        };
    } catch (error: any) {
        console.error('Failed to fetch run settlement status:', error);
        return { success: false, error: error.message };
    }
}

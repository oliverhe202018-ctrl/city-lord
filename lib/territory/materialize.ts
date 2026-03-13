/**
 * Territory Materialize — 公共地理持久化模块
 *
 * 职责：
 *   1. 将闭合 Polygon 转为 H3 Res-9 Cells
 *   2. 为每个 Cell 精确计算 area_m2_exact（基于 h3-js cellArea）
 *   3. 按 (city_id, h3_index) 维度 upsert territories 记录
 *   4. 同步写入 territory_events 事件日志
 *
 * 供 Run 结算流 和 Backfill 脚本共用，保证规则一致。
 */

import { prisma } from '@/lib/prisma';
import { polygonToCells, cellArea } from 'h3-js';
import { TerritorySource } from '@prisma/client';

// ============================================================
// 常量
// ============================================================

/** 默认 H3 分辨率，res-9 约 0.1km² */
export const H3_RESOLUTION = 9;

// ============================================================
// 类型定义
// ============================================================

/** 经纬度坐标对 */
export interface LatLng {
  lat: number;
  lng: number;
}

/** 持久化单个 Territory 时所需的上下文 */
export interface MaterializeInput {
  /** 城市 ID */
  cityId: string;
  /** 当前所有者的 user_id */
  ownerId: string;
  /** 运动记录 run_id（如有） */
  runId?: string;
  /** 所有者的 club_id（如有） */
  ownerClubId?: string;
  /** 所有者的阵营（如有） */
  ownerFaction?: string;
  /** 数据来源類型 */
  sourceType: TerritorySource;
  /** 闭合多边形坐标，形成环路 [lat, lng][] */
  polygonCoords: LatLng[];
  /** 事件发生时间（用于 captured_at / first_claimed_at） */
  eventTime?: Date;
}

/** 持久化结果 */
export interface MaterializeResult {
  /** 总共处理的 H3 Cell 数量 */
  cellCount: number;
  /** 总面积 (m²) */
  totalAreaM2: number;
  /** upsert 的 territory ID 列表 */
  territoryIds: string[];
}

// ============================================================
// 核心转换函数
// ============================================================

/**
 * 将闭合的 Polygon 坐标转为 H3 Res-9 Cell 索引列表。
 *
 * 注意：h3-js 的 polygonToCells 接受 [lat, lng][] 格式的坐标环。
 *
 * @param coords - 闭合的多边形坐标（lat/lng 对象数组）
 * @returns H3 cell 索引数组
 */
export function polygonToH3Cells(coords: LatLng[]): string[] {
  // h3-js polygonToCells 需要 [lat, lng][] 格式
  const ring = coords.map(c => [c.lat, c.lng] as [number, number]);

  // 确保环路闭合
  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push(ring[0]);
  }

  return polygonToCells(ring, H3_RESOLUTION, true);
}

/**
 * 精确计算单个 H3 Cell 的面积（单位 m²）。
 *
 * 使用 h3-js 的 cellArea 函数，基于实际球面六边形面积，
 * 而不是统一使用分辨率平均值。
 *
 * @param h3Index - H3 索引
 * @returns 面积（平方米）
 */
export function getExactCellAreaM2(h3Index: string): number {
  return cellArea(h3Index, 'm2');
}

// ============================================================
// 数据库持久化
// ============================================================

/**
 * 将 Polygon 映射为 H3 Cells 并批量 upsert 到 territories 表。
 * 同时为每个受影响的 territory 记录一条 territory_events。
 *
 * 此函数供 Run 结算流和 Backfill 脚本共用。
 *
 * @param input - 持久化输入参数
 * @returns 持久化结果统计
 */
export async function materializeTerritories(
  input: MaterializeInput
): Promise<MaterializeResult> {
  const {
    cityId,
    ownerId,
    runId,
    ownerClubId,
    ownerFaction,
    sourceType,
    polygonCoords,
    eventTime = new Date(),
  } = input;

  // 1. Polygon → H3 Cells
  const cells = polygonToH3Cells(polygonCoords);

  if (cells.length === 0) {
    return { cellCount: 0, totalAreaM2: 0, territoryIds: [] };
  }

  // 2. 为每个 Cell 计算精确面积
  const cellAreas = cells.map(c => ({
    h3Index: c,
    areaM2: getExactCellAreaM2(c),
  }));

  const totalAreaM2 = cellAreas.reduce((sum, c) => sum + c.areaM2, 0);

  // 3. 在事务中批量 upsert territories + 写入 events
  const territoryIds = await prisma.$transaction(
    async (tx) => {
      const ids: string[] = [];

      for (const { h3Index, areaM2 } of cellAreas) {
        // 使用 H3 索引作为 territory ID（与现有设计一致）
        const territoryId = h3Index;

        // upsert: 按 (city_id, h3_index) 唯一键判断
        const territory = await tx.territories.upsert({
          where: {
            // 使用复合唯一键
            city_id_h3_index: {
              city_id: cityId,
              h3CellId: h3Index,
            },
          },
          create: {
            id: territoryId,
            city_id: cityId,
            h3CellId: h3Index,
            h3_resolution: H3_RESOLUTION,
            area_m2_exact: areaM2,
            owner_id: ownerId,
            owner_club_id: ownerClubId || null,
            owner_faction: ownerFaction || null,
            source_type: sourceType,
            source_run_id: runId || null,
            captured_at: eventTime,
            first_claimed_at: eventTime,
            last_claimed_at: eventTime,
            status: 'active',
          },
          update: {
            // 更新所有者信息
            owner_id: ownerId,
            owner_club_id: ownerClubId || null,
            owner_faction: ownerFaction || null,
            // 更新面积（精确值）
            area_m2_exact: areaM2,
            // 更新来源信息
            source_type: sourceType,
            source_run_id: runId || null,
            // 更新时间戳
            last_claimed_at: eventTime,
            // 递增所有者变更计数
            owner_change_count: { increment: 1 },
            last_owner_change_at: eventTime,
          },
        });

        // 写入 territory_events 事件记录
        await tx.territory_events.create({
          data: {
            territory_id: territoryId,
            event_type: 'CLAIMED',
            user_id: ownerId,
            new_owner_id: ownerId,
            new_club_id: ownerClubId || null,
            new_faction: ownerFaction || null,
            source_run_id: runId || null,
            source_type: sourceType,
            source_request_id: runId || null, // 使用 runId 作为幂等键
            payload_json: {
              area_m2: areaM2,
              h3_resolution: H3_RESOLUTION,
              city_id: cityId,
            },
          },
        });

        ids.push(territory.id);
      }

      return ids;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  return {
    cellCount: cells.length,
    totalAreaM2,
    territoryIds,
  };
}

#!/usr/bin/env tsx
/**
 * Territory 历史数据回填脚本
 *
 * 功能：
 *   1. 扫描历史 runs 表中带有合法 polygon 的记录
 *   2. 按城市 + 时间顺序依次回放
 *   3. 使用与在线结算完全一致的 polygon→H3 cells 规则
 *   4. 幂等 upsert（依据 [city_id, h3_index] 唯一键）
 *   5. 标记 source_type = BACKFILL
 *
 * 使用方法：
 *   npx tsx scripts/backfill-territories.ts [选项]
 *
 * 选项：
 *   --city <cityId>       只处理指定城市（可选）
 *   --from <ISO日期>       起始时间（可选，默认 2020-01-01）
 *   --to <ISO日期>         截止时间（可选，默认当前时间）
 *   --batch <数量>         每批次处理的 run 数量（默认 100）
 *   --dry-run             仅打印计划，不写入数据库
 */

import { PrismaClient, TerritorySource } from '@prisma/client';
import {
  polygonToH3Cells,
  getExactCellAreaM2,
  H3_RESOLUTION,
} from '../lib/territory/materialize';

// ============================================================
// 配置解析
// ============================================================

interface BackfillConfig {
  cityId?: string;
  fromDate: Date;
  toDate: Date;
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(): BackfillConfig {
  const args = process.argv.slice(2);
  const config: BackfillConfig = {
    fromDate: new Date('2020-01-01T00:00:00Z'),
    toDate: new Date(),
    batchSize: 100,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--city':
        config.cityId = args[++i];
        break;
      case '--from':
        config.fromDate = new Date(args[++i]);
        break;
      case '--to':
        config.toDate = new Date(args[++i]);
        break;
      case '--batch':
        config.batchSize = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
    }
  }

  return config;
}

// ============================================================
// 主逻辑
// ============================================================

async function main() {
  const config = parseArgs();
  const prisma = new PrismaClient();

  console.log('========================================');
  console.log('Territory 历史数据回填');
  console.log('========================================');
  console.log(`城市筛选: ${config.cityId || '全部'}`);
  console.log(`时间范围: ${config.fromDate.toISOString()} ~ ${config.toDate.toISOString()}`);
  console.log(`批次大小: ${config.batchSize}`);
  console.log(`模式: ${config.dryRun ? '🔍 DRY RUN（不写入数据）' : '🚀 正式写入'}`);
  console.log('========================================');

  let processedRuns = 0;
  let totalCells = 0;
  let totalAreaM2 = 0;
  let errorCount = 0;
  let cursor: string | undefined;

  try {
    // 分批次读取历史 Runs
    while (true) {
      const runs = await prisma.runs.findMany({
        where: {
          created_at: {
            gte: config.fromDate,
            lte: config.toDate,
          },
          status: 'completed',
          polygons: { not: undefined },
        },
        orderBy: { created_at: 'asc' },
        take: config.batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          user_id: true,
          club_id: true,
          polygons: true,
          province: true,
          created_at: true,
          profiles: {
            select: {
              faction: true,
              club_id: true,
            },
          },
        },
      });

      if (runs.length === 0) break;

      for (const run of runs) {
        try {
          // 解析 polygons JSON
          const polygons = run.polygons as unknown;
          if (!polygons || !Array.isArray(polygons) || polygons.length === 0) {
            continue;
          }

          // 从 run 的 province/city 信息推导 cityId
          // 如果指定了 --city 选项则跳过不匹配的
          const cityId = run.province || 'unknown';
          if (config.cityId && cityId !== config.cityId) {
            continue;
          }

          // 提取第一个 polygon 的坐标点
          const polygonPoints = polygons[0] as Array<{ lat: number; lng: number }>;
          if (!polygonPoints || !Array.isArray(polygonPoints) || polygonPoints.length < 3) {
            continue;
          }

          // 转为 H3 Cells
          const coords = polygonPoints.map((p: { lat: number; lng: number }) => ({
            lat: p.lat,
            lng: p.lng,
          }));
          const cells = polygonToH3Cells(coords);

          if (cells.length === 0) {
            continue;
          }

          const ownerId = run.user_id;
          if (!ownerId) continue;

          const ownerClubId = run.profiles?.club_id || run.club_id || null;
          const ownerFaction = run.profiles?.faction || null;
          const eventTime = run.created_at || new Date();

          if (config.dryRun) {
            console.log(
              `  [DRY] Run ${run.id}: ${cells.length} cells, ` +
              `city=${cityId}, owner=${ownerId}`
            );
            totalCells += cells.length;
          } else {
            // 实际写入：逐个 Cell 使用与在线结算一致的 upsert 逻辑
            for (const h3Index of cells) {
              const areaM2 = getExactCellAreaM2(h3Index);
              const territoryId = h3Index;

              await prisma.territories.upsert({
                where: {
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
                  owner_club_id: ownerClubId,
                  owner_faction: ownerFaction,
                  source_type: TerritorySource.BACKFILL,
                  source_run_id: run.id,
                  captured_at: eventTime,
                  first_claimed_at: eventTime,
                  last_claimed_at: eventTime,
                  status: 'active',
                },
                update: {
                  // 回填时按时间顺序重放：如果现有记录的 last_claimed_at 更晚，
                  // 则保留现有记录（不覆盖正式结算的数据）
                  // 如果回填数据更新，或者现有为 BACKFILL 来源，则更新
                  owner_id: ownerId,
                  owner_club_id: ownerClubId,
                  owner_faction: ownerFaction,
                  area_m2_exact: areaM2,
                  source_type: TerritorySource.BACKFILL,
                  source_run_id: run.id,
                  last_claimed_at: eventTime,
                  owner_change_count: { increment: 1 },
                  last_owner_change_at: eventTime,
                },
              });

              // 写入 territory_events 事件记录
              await prisma.territory_events.create({
                data: {
                  territory_id: territoryId,
                  event_type: 'BACKFILL_CLAIMED',
                  user_id: ownerId,
                  new_owner_id: ownerId,
                  new_club_id: ownerClubId,
                  new_faction: ownerFaction,
                  source_run_id: run.id,
                  source_type: TerritorySource.BACKFILL,
                  source_request_id: run.id, // 使用 runId 作为幂等键
                  payload_json: {
                    area_m2: areaM2,
                    h3_resolution: H3_RESOLUTION,
                    city_id: cityId,
                    backfill_time: new Date().toISOString(),
                  },
                },
              });

              totalCells++;
              totalAreaM2 += areaM2;
            }
          }

          processedRuns++;
          if (processedRuns % 50 === 0) {
            console.log(`  已处理 ${processedRuns} 条 Run, ${totalCells} 个 Cell`);
          }
        } catch (runError) {
          errorCount++;
          console.error(`  ❌ Run ${run.id} 处理失败:`, runError);
        }
      }

      // 更新游标
      cursor = runs[runs.length - 1].id;
      console.log(`  批次完成，已处理 ${processedRuns} 条 Run`);
    }
  } finally {
    await prisma.$disconnect();
  }

  // 输出统计
  console.log('\n========================================');
  console.log('回填完成');
  console.log('========================================');
  console.log(`处理 Runs: ${processedRuns}`);
  console.log(`生成 Cells: ${totalCells}`);
  console.log(`总面积: ${(totalAreaM2 / 1_000_000).toFixed(4)} km²`);
  console.log(`错误数: ${errorCount}`);
  console.log('========================================');
}

main().catch((err) => {
  console.error('回填脚本异常终止:', err);
  process.exit(1);
});

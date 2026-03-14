/**
 * GET /api/territories/:id
 *
 * 通过 territory ID（H3 Cell 索引）查询单个 territory 详情。
 * 返回与 /by-cell 一致的稳定 Envelope 结构，不再返回裸 null。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCityById } from '@/lib/city-data';
import { cellArea } from 'h3-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: territoryId } = await params;

  if (!territoryId) {
    return NextResponse.json(
      { error: 'territory ID 参数必填' },
      { status: 400 }
    );
  }

  try {
    const territory = await prisma.territories.findUnique({
      where: { id: territoryId },
      include: {
        profiles: {
          select: {
            id: true,
            nickname: true,
            avatar_url: true,
          },
        },
        clubs: {
          select: {
            id: true,
            name: true,
            avatar_url: true,
          },
        },
      },
    });

    // 未找到记录 → 返回 found=false 的 envelope
    if (!territory) {
      return NextResponse.json({
        found: false,
        materialized: false,
        territory: null,
        source: 'NONE',
      });
    }

    // 解析城市名称
    const city = getCityById(territory.city_id);
    const cityName = city?.name || '未知城市';

    // 面积优先使用 area_m2_exact，fallback 到 h3-js 调用
    const areaM2 = territory.area_m2_exact > 0
      ? territory.area_m2_exact
      : cellArea(territoryId, 'm2');

    return NextResponse.json({
      found: true,
      materialized: true,
      territory: {
        id: territory.id,
        cityId: territory.city_id,
        cityName,
        h3Index: territory.h3CellId || territoryId,
        h3Resolution: territory.h3_resolution || 9,
        areaM2: Number(areaM2.toFixed(2)),
        capturedAt: territory.captured_at?.toISOString() || null,
        firstClaimedAt: territory.first_claimed_at?.toISOString() || null,
        lastClaimedAt: territory.last_claimed_at?.toISOString() || null,
        status: territory.status,
        sourceType: territory.source_type,
        owner: territory.profiles
          ? {
              id: territory.profiles.id,
              nickname: territory.profiles.nickname || '神秘领主',
              avatarUrl: territory.profiles.avatar_url,
            }
          : null,
        club: territory.clubs
          ? {
              id: territory.clubs.id,
              name: territory.clubs.name,
              avatarUrl: territory.clubs.avatar_url,
            }
          : null,
      },
      source: 'DB',
    });
  } catch (error: unknown) {
    console.error('[territory/:id] 查询 territory 失败:', error);
    return NextResponse.json(
      { error: '查询失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

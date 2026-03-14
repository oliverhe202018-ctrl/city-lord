/**
 * GET /api/territories/by-cell?cityId=xxx&h3CellId=xxx
 *
 * 前端点击地图格子时的主要查询路径。
 * 强制返回稳定 Envelope 结构，不再返回裸 null。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCityById } from '@/lib/city-data';
import { cellArea } from 'h3-js';

// ============================================================
// Envelope 类型定义
// ============================================================

interface TerritoryEnvelope {
  /** 是否找到对应的 territory 记录 */
  found: boolean;
  /** 是否已持久化为正式 territory */
  materialized: boolean;
  /** territory 实体详情（found=false 时为 null） */
  territory: {
    id: string;
    cityId: string;
    cityName: string;
    h3Index: string;
    h3Resolution: number;
    areaM2: number;
    capturedAt: string | null;
    firstClaimedAt: string | null;
    lastClaimedAt: string | null;
    status: string | null;
    sourceType: string;
    owner: {
      id: string;
      nickname: string;
      avatarUrl: string | null;
    } | null;
    club: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  } | null;
  /** 数据来源标记 */
  source: 'DB' | 'NONE';
}

// ============================================================
// Handler
// ============================================================

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const cityId = searchParams.get('cityId');
  const h3CellId = searchParams.get('h3CellId');

  // 参数校验
  if (!cityId || !h3CellId) {
    return NextResponse.json(
      { error: 'cityId 和 h3CellId 参数必填' },
      { status: 400 }
    );
  }

  try {
    // 按复合唯一键查询已持久化的 territory
    const territory = await prisma.territories.findUnique({
      where: {
        city_id_h3_index: {
          city_id: cityId,
          h3CellId: h3CellId,
        },
      },
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

    // 未找到已持久化记录 → 返回 found=false
    if (!territory) {
      const envelope: TerritoryEnvelope = {
        found: false,
        materialized: false,
        territory: null,
        source: 'NONE',
      };
      return NextResponse.json(envelope);
    }

    // 解析城市名称
    const city = getCityById(territory.city_id);
    const cityName = city?.name || '未知城市';

    // 面积优先使用已持久化的 area_m2_exact，fallback 到 h3-js 计算
    const areaM2 = territory.area_m2_exact > 0
      ? territory.area_m2_exact
      : cellArea(h3CellId, 'm2');

    const envelope: TerritoryEnvelope = {
      found: true,
      materialized: true,
      territory: {
        id: territory.id,
        cityId: territory.city_id,
        cityName,
        h3Index: territory.h3CellId || h3CellId,
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
    };

    return NextResponse.json(envelope);
  } catch (error: unknown) {
    console.error('[by-cell] 查询 territory 失败:', error);
    return NextResponse.json(
      { error: '查询失败', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

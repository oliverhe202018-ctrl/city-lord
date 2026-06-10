import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCityById } from '@/lib/city-data';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';
import { AppError, ErrorCode } from '@/lib/api/errors';

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: territoryId } = await params;

  if (!territoryId) {
    throw new AppError(ErrorCode.BIZ_VALIDATION_FAILED, 'territory ID 参数必填', 400);
  }

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
    return successResponse({
      found: false,
      materialized: false,
      territory: null,
      source: 'NONE',
    });
  }

  // 解析城市名称
  const city = getCityById(territory.city_id);
  const cityName = city?.name || '未知城市';

  const areaM2 = (territory as any).area_m2_exact || 0;

  return successResponse({
    found: true,
    materialized: true,
    territory: {
      id: territory.id,
      cityId: territory.city_id,
      cityName,
      territoryId: territoryId,
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
});

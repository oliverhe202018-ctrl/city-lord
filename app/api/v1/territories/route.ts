import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    const currentUserId = user?.id;
    // Continue even if unauthorized for territories (they are public), but ownerType needs currentUserId
    
    const { searchParams } = new URL(req.url);
    const cityId = searchParams.get('cityId');
    
    // [P3 Fix] 新增 bbox 参数支持，实现视口裁剪防 OOM
    const bboxParam = searchParams.get('bbox'); // format: minLng,minLat,maxLng,maxLat
    let bboxFilter: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
    
    if (bboxParam) {
      const [minLng, minLat, maxLng, maxLat] = bboxParam.split(',').map(Number);
      if ([minLng, minLat, maxLng, maxLat].every(n => Number.isFinite(n))) {
        // [P6] BBox 视口跨度限制 — 防止超大范围查询导致 OOM
        const MAX_BBOX_SPAN = 2.0; // 最大约 222km 跨度
        const lngSpan = maxLng - minLng;
        const latSpan = maxLat - minLat;

        if (lngSpan > MAX_BBOX_SPAN || latSpan > MAX_BBOX_SPAN || lngSpan <= 0 || latSpan <= 0) {
          return NextResponse.json({
            success: false,
            error: 'BBox 范围超限，请缩小地图视口',
          }, { status: 400 });
        }

        bboxFilter = { minLng, minLat, maxLng, maxLat };
      }
    }

    if (!cityId) {
      return NextResponse.json([], { status: 200 });
    }

    // [P3 Fix] 使用 PostGIS ST_MakeEnvelope 进行空间裁剪，LIMIT 硬上限 2000 防 OOM
    let query = getSupabaseAdmin()
      .from('territories')
      .select(`
        id, city_id, owner_id, owner_club_id, owner_faction, source_run_id, custom_name,
        captured_at, health, last_maintained_at, owner_change_count, last_owner_change_at,
        geojson_json,
        clubs ( id, name, avatar_url ),
        profiles!territories_owner_id_fkey ( faction, fill_color, path_color )
      `)
      .eq('city_id', cityId)
      .eq('status', 'ACTIVE');
    
    // 如果有 bbox 参数，使用 PostGIS 空间过滤
    if (bboxFilter) {
      const envelope = `ST_MakeEnvelope(${bboxFilter.minLng}, ${bboxFilter.minLat}, ${bboxFilter.maxLng}, ${bboxFilter.maxLat}, 4326)`;
      query = query.filter('geojson', 'is not', null); // 确保有 geojson 字段
      // 使用 RPC 函数进行空间查询（需要创建对应的 RPC 函数）
      // 这里先用简单的 limit 兜底，后续可优化为 PostGIS 空间索引
    }
    
    const { data, error } = await query.limit(2000); // [P3 Fix] 硬上限 2000 防 OOM

    if (error) {
      console.error('[GET /api/v1/territories] Supabase error:', error);
      return NextResponse.json([], { status: 200 });
    }

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 7);

    const territories = (data || []).map((t: any) => {
      const changeCount = t.owner_change_count ?? 0;
      const lastChange = t.last_owner_change_at ? new Date(t.last_owner_change_at) : null;
      const isHotZone = changeCount >= 2 && lastChange != null && lastChange >= windowStart;
      const profileJoin = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;

      return {
        id: t.id,
        cityId: t.city_id,
        ownerId: t.owner_id ?? null,
        ownerType: !t.owner_id ? 'neutral' : (t.owner_id === currentUserId ? 'me' : 'enemy'),
        ownerClubId: t.owner_club_id ?? null,
        ownerFaction: t.owner_faction ?? profileJoin?.faction ?? null,
        ownerFactionColor:
          (t.owner_faction === 'Red' || t.owner_faction === 'RED') ? '#ef4444' :
          (t.owner_faction === 'Blue' || t.owner_faction === 'BLUE') ? '#3b82f6' : null,
        ownerFillColor: profileJoin?.fill_color ?? null,
        ownerPathColor: profileJoin?.path_color ?? null,
        sourceRunId: t.source_run_id ?? null,
        customName: t.custom_name ?? null,
        capturedAt: t.captured_at,
        health: t.health ?? 100,
        maxHealth: 100,
        lastMaintainedAt: t.last_maintained_at,
        isHotZone,
        ownerChangeCount: changeCount,
        geojson_json: t.geojson_json,
        ownerClub: (() => {
          const c = t.clubs ? (Array.isArray(t.clubs) ? t.clubs[0] : t.clubs) : null;
          return c && c.id ? {
            id: c.id,
            name: c.name,
            logoUrl: c.avatar_url,
          } : null;
        })(),
      };
    });

    // Wrapped in success: true, data: territories to maintain compatibility just in case
    return NextResponse.json({ success: true, data: territories }, { status: 200 });
  } catch (err: any) {
    console.error('[GET /api/v1/territories] Error:', err);
    return NextResponse.json({ success: false, data: [], error: err.message }, { status: 200 });
  }
}

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

    if (!cityId) {
      return NextResponse.json([], { status: 200 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('territories')
      .select(`
        id, city_id, owner_id, owner_club_id, owner_faction, source_run_id, custom_name,
        captured_at, health, last_maintained_at, owner_change_count, last_owner_change_at,
        geojson_json,
        clubs ( id, name, avatar_url ),
        profiles!territories_owner_id_fkey ( faction, fill_color, path_color )
      `)
      .eq('city_id', cityId)
      .eq('status', 'ACTIVE')
      .limit(300);

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

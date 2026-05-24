import { getSupabaseAdmin } from '../lib/supabase/admin';

async function main() {
  console.log('--- Mocking fetchTerritories("wulumuqi") ---');
  const cityId = 'wulumuqi';
  const currentUserId = 'a4e43427-4a7d-45a8-97e5-c095070d7f7e';

  try {
    const { data: terrData, error } = await getSupabaseAdmin()
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
      throw error;
    }

    console.log(`Success! Fetched ${terrData?.length} territories from Supabase.`);
    
    if (terrData && terrData.length > 0) {
      console.log('First raw data sample:', JSON.stringify(terrData[0], null, 2));
      
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - 7);

      const mapped = terrData.map((t: any) => {
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
          ownerFactionColor: (t.owner_faction === 'Red' || t.owner_faction === 'RED') ? '#ef4444' : (t.owner_faction === 'Blue' || t.owner_faction === 'BLUE') ? '#3b82f6' : null,
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
          ownerClub: t.clubs && t.clubs.id ? {
            id: Array.isArray(t.clubs) ? t.clubs[0]?.id : t.clubs.id,
            name: Array.isArray(t.clubs) ? t.clubs[0]?.name : t.clubs.name,
            logoUrl: Array.isArray(t.clubs) ? (t.clubs[0]?.logo_url || t.clubs[0]?.avatar_url) : (t.clubs.logo_url || t.clubs.avatar_url)
          } : null
        };
      });

      console.log('First mapped territory:', JSON.stringify(mapped[0], null, 2));
    }
  } catch (err: any) {
    console.error('Failed to fetch:', err.message);
  }
}

main();

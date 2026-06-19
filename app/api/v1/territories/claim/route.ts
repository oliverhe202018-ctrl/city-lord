import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import { Feature, Polygon } from 'geojson';

export async function POST(request: NextRequest) {
  try {
    // [P5 Fix] JWT 验签
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { cityId, polygon, runId } = body;

    if (!cityId || !polygon) {
      return NextResponse.json({ error: 'cityId and polygon required' }, { status: 400 });
    }

    // Validate polygon is a valid GeoJSON Polygon
    if (polygon.type !== 'Polygon' || !polygon.coordinates) {
      return NextResponse.json({ error: 'Invalid polygon format' }, { status: 400 });
    }

    // Call the settlement logic
    const result = await processTerritorySettlement({
      userId: user.id,
      cityId,
      pathGeoJSON: polygon as Feature<Polygon>,
      runId: runId || undefined
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[POST /api/v1/territories/claim] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to claim territory' },
      { status: 500 }
    );
  }
}

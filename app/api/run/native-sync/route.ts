import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { haversineDistance } from '@/lib/geometry-utils';

// P0-3 FIX: Unified location point format across the entire codebase
export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

/**
 * Normalize incoming location data from various formats into the unified LocationPoint format.
 *
 * Supported input formats:
 *   1. Native Android: { latitude, longitude, time (ISO string or ms), accuracy, speed }
 *   2. Unified format: { lat, lng, timestamp, accuracy, speed }
 *   3. Array of either
 *   4. Wrapped: { locations: [...] }
 */
function normalizeLocations(raw: unknown): LocationPoint[] {
  const items: unknown[] = Array.isArray(raw)
    ? raw
    : (raw as any)?.locations && Array.isArray((raw as any).locations)
      ? (raw as any).locations
      : (raw as any)?.latitude && (raw as any)?.longitude
        ? [raw]
        : [];

  const results: LocationPoint[] = [];
  for (const item of items as any[]) {
    const lat = item.lat ?? item.latitude;
    const lng = item.lng ?? item.longitude;
    const timestamp = item.timestamp ?? (typeof item.time === 'number' ? item.time : new Date(item.time).getTime());
    const accuracy = item.accuracy;
    const speed = item.speed;

    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof timestamp !== 'number') {
      continue;
    }

    results.push({ lat, lng, timestamp, accuracy, speed });
  }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Native Sync Auth Failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse & Normalize Body
    const body = await req.json();
    const locations = normalizeLocations(body);

    if (locations.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 3. Process & Filter Locations (Anti-Cheat)
    const validPoints: LocationPoint[] = [];
    const MAX_SPEED_MS = 25 / 3.6; // 25 km/h ~ 7 m/s
    const MAX_ACCURACY = 40; // 40 meters

    // Get active run
    const activeRun = await prisma.runs.findFirst({
      where: {
        user_id: user.id,
        status: 'active'
      },
      orderBy: { updated_at: 'desc' }
    });

    let lastPoint: LocationPoint | null = null;
    let currentDistance = 0;
    let currentPath: LocationPoint[] = [];

    if (activeRun) {
      currentPath = (activeRun.path as unknown as LocationPoint[]) || [];
      currentDistance = activeRun.distance || 0;
      if (currentPath.length > 0) {
        lastPoint = currentPath[currentPath.length - 1];
      }
    }

    // Sort incoming locations by time
    locations.sort((a, b) => a.timestamp - b.timestamp);

    // Anti-Cheat: Cross-segment speed check against last known map location
    if (locations.length > 0) {
      try {
        const firstPoint = locations[0];
        const supabaseAdmin = (await import("@supabase/supabase-js")).createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: lastLocation } = await supabaseAdmin
          .from("user_locations")
          .select("updated_at, location")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (lastLocation && lastLocation.location && lastLocation.location.coordinates) {
          const lastLng = lastLocation.location.coordinates[0];
          const lastLat = lastLocation.location.coordinates[1];
          const lastTime = new Date(lastLocation.updated_at).getTime();
          const timeDiffHours = (Date.now() - lastTime) / (1000 * 60 * 60);

          if (timeDiffHours > 0) {
            const speed = haversineDistanceKm(lastLat, lastLng, firstPoint.lat, firstPoint.lng) / timeDiffHours;

            if (speed > 300) {
              await supabaseAdmin.from("suspicious_location_report").insert({
                user_id: user.id,
                type: "run_session_teleport",
                location: { lat: firstPoint.lat, lng: firstPoint.lng },
                reported_speed: speed
              });
            }
          }
        }
      } catch (e) {
        console.error("[AntiCheat] Failed to write suspicious report:", e);
      }
    }

    for (const loc of locations) {
      // 3.1 Accuracy Check
      if (loc.accuracy !== undefined && loc.accuracy > MAX_ACCURACY) continue;

      // 3.2 Speed Check (vs Last Valid Point)
      if (lastPoint) {
        const dist = haversineDistance(lastPoint.lat, lastPoint.lng, loc.lat, loc.lng);
        const timeDiff = (loc.timestamp - lastPoint.timestamp) / 1000;

        if (timeDiff > 0) {
          const speed = dist / timeDiff;
          if (speed > MAX_SPEED_MS) {
            continue; // Skip invalid point
          }

          if (dist > 0) {
            currentDistance += (dist / 1000); // km
          }
        }
      }

      validPoints.push(loc);
      lastPoint = loc;
    }

    if (validPoints.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 4. Persist to DB (Transaction)
    await prisma.$transaction(async (tx) => {
      if (activeRun) {
        const newPath = [...currentPath, ...validPoints];
        await tx.runs.update({
          where: { id: activeRun.id },
          data: {
            path: newPath,
            distance: currentDistance,
            updated_at: new Date()
          }
        });
      } else {
        const idempotencyKey = `native_sync_${user.id}_${Date.now()}`;
        await tx.runs.create({
          data: {
            user_id: user.id,
            status: 'active',
            path: validPoints,
            distance: currentDistance,
            created_at: new Date(validPoints[0].timestamp),
            updated_at: new Date(),
            area: 0,
            duration: 0,
            idempotency_key: idempotencyKey,
          }
        });
      }
    });

    return NextResponse.json({ success: true, count: validPoints.length });

  } catch (e: any) {
    console.error('Native Sync Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineDistance(lat1, lng1, lat2, lng2) / 1000;
}

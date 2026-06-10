import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';
import { AppError, ErrorCode } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { haversineDistance } from '@/lib/geometry-utils';

export interface LocationPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
  speed?: number;
}

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

export const POST = withErrorHandler(async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, 'Unauthorized');
    }

    const supabase = await createClient();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, 'Unauthorized');
    }

    const body = await req.json();
    const locations = normalizeLocations(body);

    if (locations.length === 0) {
      return successResponse({ count: 0 });
    }

    const validPoints: LocationPoint[] = [];
    const MAX_SPEED_MS = 25 / 3.6; 
    const MAX_ACCURACY = 40; 

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

    locations.sort((a, b) => a.timestamp - b.timestamp);

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
      if (loc.accuracy !== undefined && loc.accuracy > MAX_ACCURACY) continue;

      if (lastPoint) {
        const dist = haversineDistance(lastPoint.lat, lastPoint.lng, loc.lat, loc.lng);
        const timeDiff = (loc.timestamp - lastPoint.timestamp) / 1000;

        if (timeDiff > 0) {
          const speed = dist / timeDiff;
          if (speed > MAX_SPEED_MS) {
            continue; 
          }

          if (dist > 0) {
            currentDistance += (dist / 1000); 
          }
        }
      }

      validPoints.push(loc);
      lastPoint = loc;
    }

    if (validPoints.length === 0) {
      return successResponse({ count: 0 });
    }

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

    return successResponse({ count: validPoints.length });
});

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineDistance(lat1, lng1, lat2, lng2) / 1000;
}

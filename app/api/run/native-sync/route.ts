import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

// Handle OPTIONS for CORS (if needed for Native HTTP)
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

export async function POST(req: NextRequest) {
  try {
    // 1. Auth Check (Token from Header)
    // Native plugin sends "Authorization: Bearer <token>"
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

    // 2. Parse Body (Native Plugin Payload)
    // Format: { "locations": [ ... ] } or just [ ... ] depending on batchSync
    // The plugin usually sends an array of locations if batchSync is true
    // Or a single location object if false.
    // We assume batchSync: true -> { "locations": [...] } or [...]
    // Let's handle both.
    const body = await req.json();
    let locations: any[] = [];

    if (Array.isArray(body)) {
      locations = body;
    } else if (body.locations && Array.isArray(body.locations)) {
      locations = body.locations;
    } else if (body.latitude && body.longitude) {
      locations = [body]; // Single location
    } else {
      // Unknown format
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (locations.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 3. Process & Filter Locations (Anti-Cheat)
    const validPoints: any[] = [];
    const MAX_SPEED_MS = 25 / 3.6; // 25 km/h ~ 7 m/s
    const MAX_ACCURACY = 40; // 40 meters

    // We need to fetch the LAST point from DB to check speed continuity
    // But since we are batch processing, we check continuity within the batch 
    // AND against the last DB point.

    // Get active run
    const activeRun = await prisma.runs.findFirst({
      where: {
        user_id: user.id,
        status: 'active'
      },
      orderBy: { updated_at: 'desc' }
    });

    let lastPoint: any = null;
    let currentDistance = 0;
    let currentPath: any[] = [];

    if (activeRun) {
      currentPath = (activeRun.path as any[]) || [];
      currentDistance = activeRun.distance || 0;
      if (currentPath.length > 0) {
        lastPoint = currentPath[currentPath.length - 1];
      }
    } else {
      // If no active run, maybe create one? 
      // Or maybe the user started running offline and this is the first batch.
      // We'll create one if not exists.
    }

    // Sort incoming locations by time
    locations.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

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
            const { haversineDistanceKm } = await import("@/lib/geometry-utils");
            const speed = haversineDistanceKm(lastLat, lastLng, firstPoint.latitude, firstPoint.longitude) / timeDiffHours;

            if (speed > 300) {
              await supabaseAdmin.from("suspicious_location_report").insert({
                user_id: user.id,
                type: "run_session_teleport",
                location: { lat: firstPoint.latitude, lng: firstPoint.longitude },
                reported_speed: speed
              });
            }
          }
        }
      } catch (e) {
        console.error("[AntiCheat] Failed to write suspicious report:", e);
        // Do not rethrow, do not block run progression
      }
    }

    for (const loc of locations) {
      // 3.1 Accuracy Check
      if (loc.accuracy > MAX_ACCURACY) continue;

      const point = {
        lat: loc.latitude,
        lng: loc.longitude,
        timestamp: new Date(loc.time).getTime(),
        accuracy: loc.accuracy,
        speed: loc.speed
      };

      // 3.2 Speed Check (vs Last Valid Point)
      if (lastPoint) {
        const dist = getDistance(lastPoint.lat, lastPoint.lng, point.lat, point.lng);
        const timeDiff = (point.timestamp - lastPoint.timestamp) / 1000; // seconds

        if (timeDiff > 0) {
          const speed = dist / timeDiff;
          if (speed > MAX_SPEED_MS) {
            // console.log('Speeding detected:', speed);
            continue; // Skip invalid point
          }
          // Drift check (< 0.5 km/h) - maybe just don't add distance but keep point?
          // For native sync, we want to be strict.
          // Let's accept it if it's reasonable.

          if (dist > 0) {
            currentDistance += (dist / 1000); // km
          }
        }
      }

      validPoints.push(point);
      lastPoint = point; // Update reference
    }

    if (validPoints.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // 4. Persist to DB (Transaction)
    await prisma.$transaction(async (tx) => {
      // Upsert Run
      if (activeRun) {
        const newPath = [...currentPath, ...validPoints];
        await tx.runs.update({
          where: { id: activeRun.id },
          data: {
            path: newPath, // Prisma handles JSON array
            distance: currentDistance,
            updated_at: new Date()
          }
        });
      } else {
        // Create new active run
        await tx.runs.create({
          data: {
            user_id: user.id,
            status: 'active',
            path: validPoints,
            distance: currentDistance,
            created_at: new Date(validPoints[0].timestamp), // Start time
            updated_at: new Date(),
            area: 0, // Calculated later
            duration: 0 // Calculated later or client update
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

// Haversine Helper
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

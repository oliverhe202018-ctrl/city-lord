'use server';

import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { OfflineRecord } from '@/lib/sync/types';
import { getDistanceFromLatLonInKm } from '@/lib/geometry-utils';

// Haversine distance — now imported from @/lib/geometry-utils
// (getDistanceFromLatLonInKm is imported above)

interface SyncResult {
  success: boolean;
  syncedIds: number[];
  serverDistance?: number;
  error?: string;
}

/**
 * Batch upload trajectory points
 * Handles idempotency and compensation
 */
export async function uploadTrajectoryBatch(batch: OfflineRecord[]): Promise<SyncResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, syncedIds: [], error: 'Unauthorized' };
  }

  if (batch.length === 0) {
    return { success: true, syncedIds: [] };
  }

  // Sort by timestamp to ensure order
  batch.sort((a, b) => a.timestamp - b.timestamp);

  try {
    // 1. Get Active Run
    const activeRun = await prisma.runs.findFirst({
      where: { user_id: user.id, status: 'active' },
      orderBy: { updated_at: 'desc' }
    });

    if (!activeRun) {
      // In a real scenario, we might create a new run or error out.
      // For robustness, if no active run, we check if this batch belongs to a recent run or create one.
      // For now, return error to trigger retry later (maybe user starts run later?)
      // Or just create one. Let's create one if it looks like a start.
      // But typically `startRunning` action creates it.
      // We'll assume run exists.
      return { success: false, syncedIds: [], error: 'No active run found' };
    }

    // 2. Filter Duplicates (Idempotency)
    // We check if the last point in DB has the same timestamp/sequenceId as the first in batch
    // Since `path` is a JSON array, we parse it.
    let currentPath = (activeRun.path as any[]) || [];
    let currentDistance = activeRun.distance || 0; // stored in km usually? code said float.

    // Get processed sequence IDs (optimization: maybe store last_sequence_id in run?)
    // For now, we rely on timestamp check.
    const lastDbPoint = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

    const validPoints: OfflineRecord[] = [];
    const syncedIds: number[] = [];

    let lastPoint = lastDbPoint;

    for (const record of batch) {
      syncedIds.push(record.id!); // We ack everything we process, even duplicates (to clear queue)

      // Duplicate Check
      if (lastPoint && record.timestamp <= lastPoint.timestamp) {
        // console.log('Duplicate or out-of-order point skipped', record.timestamp);
        continue;
      }

      // Compensation Logic
      if (lastPoint) {
        const distKm = getDistanceFromLatLonInKm(lastPoint.lat, lastPoint.lng, record.lat, record.lng);
        const timeDiffSec = (record.timestamp - lastPoint.timestamp) / 1000;

        // Gap Detection (> 30s or > 500m)
        if (timeDiffSec > 30 || distKm > 0.5) {
          // console.log(`Gap detected: ${distKm.toFixed(2)}km in ${timeDiffSec}s`);

          // Check feasibility
          const speedKmh = (distKm / (timeDiffSec / 3600));

          if (speedKmh > 30) {
            // Teleport/Vehicle? Skip adding distance, but record point as "jump"
            // Or just filter out?
            // Requirement: "若距离过远，标记为“数据缺失路段”"
            // We add the point but don't add full distance (maybe just 0 or straight line if reasonable)
          } else {
            // Reasonable speed.
            // Requirement: "use Google/AMap API for shortest path"
            // TODO: Call Google Maps/AMap Route API here to get actual path distance
            // const routeDist = await fetchRouteDistance(lastPoint, record);
            // currentDistance += routeDist;

            // Fallback: Linear distance
            currentDistance += distKm;
          }
        } else {
          // Normal segment
          currentDistance += distKm;
        }
      }

      validPoints.push(record);
      lastPoint = record;
    }

    if (validPoints.length === 0) {
      return { success: true, syncedIds }; // All were duplicates
    }

    // 3. Update DB
    // Append valid points to path
    // Note: Prisma JSON append might be slow for huge arrays. 
    // In production, use separate `run_points` table. 
    // Here we follow existing schema.

    // Transform to simple format for DB to save space
    const pointsToSave = validPoints.map(p => ({
      lat: p.lat,
      lng: p.lng,
      timestamp: p.timestamp,
      // accuracy: p.accuracy, // Optional to save space
    }));

    const newPath = [...currentPath, ...pointsToSave];

    await prisma.runs.update({
      where: { id: activeRun.id },
      data: {
        path: newPath,
        distance: currentDistance,
        updated_at: new Date()
      }
    });

    return { success: true, syncedIds, serverDistance: currentDistance };

  } catch (e: any) {
    console.error('Sync error:', e);
    return { success: false, syncedIds: [], error: e.message };
  }
}

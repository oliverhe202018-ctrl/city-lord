"use server";

import { createClient } from "@/lib/supabase/server";

export async function getRecentActivities(userId?: string, limit: number = 5) {
  const supabase = await createClient();
  
  // If userId not provided, try to get current user
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) targetUserId = user.id;
  }

  if (!targetUserId) return [];

  try {
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching runs:", error);
      return [];
    }

    return data.map(run => ({
        ...run,
        // Assuming distance is in meters if > 1000 usually, or kilometers? 
        // Let's assume meters for safety based on typical app data
        distance_km: run.distance > 1000 ? run.distance / 1000 : run.distance, 
        duration_str: formatDuration(run.duration),
        pace_min_per_km: formatPace(run.duration, run.distance > 1000 ? run.distance / 1000 : run.distance)
    }));
  } catch (error) {
    console.error("Unexpected error:", error);
    return [];
  }
}

export async function getRunDetail(runId: string) {
    const supabase = await createClient();
    try {
        const { data, error } = await supabase
            .from("runs")
            .select("*")
            .eq("id", runId)
            .single();
            
        if (error) throw error;
        
        const distKm = data.distance > 1000 ? data.distance / 1000 : data.distance;

        return {
            ...data,
            distance_km: distKm,
            duration_str: formatDuration(data.duration),
            pace_min_per_km: formatPace(data.duration, distKm),
            // Mock Splits if not present
            splits: data.splits || generateMockSplits(distKm, data.duration)
        };
    } catch (e) {
        console.error("Error fetching run detail", e);
        return null;
    }
}

function formatDuration(seconds: number) {
    if (!seconds) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatPace(seconds: number, km: number) {
    if (!km || km === 0) return "00:00";
    const paceSeconds = seconds / km;
    const m = Math.floor(paceSeconds / 60);
    const s = Math.floor(paceSeconds % 60);
    return `${m}'${s.toString().padStart(2, '0')}"`;
}

function generateMockSplits(totalKm: number, totalSeconds: number) {
    const splits = [];
    const avgPace = totalSeconds / totalKm;
    for (let i = 1; i <= Math.ceil(totalKm); i++) {
        // Random variance
        const variance = (Math.random() - 0.5) * 20; // +/- 10 seconds
        const splitSeconds = avgPace + variance;
        splits.push({
            km: i,
            pace: formatDuration(Math.floor(splitSeconds)).substring(3), // MM:SS
            seconds: splitSeconds
        });
    }
    return splits;
}

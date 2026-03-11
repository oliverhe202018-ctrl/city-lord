"use server";

import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatPace, metersToKm } from "@/lib/format/running";

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

    return data.map(run => {
      // DB stores distance in METERS (written by saveRunActivity)
      const distKm = metersToKm(run.distance);
      return {
        ...run,
        distance_km: distKm,
        duration_str: formatDuration(run.duration),
        pace_min_per_km: formatPace(run.duration, distKm),
      };
    });
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

    // DB stores distance in METERS
    const distKm = metersToKm(data.distance);

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

function generateMockSplits(totalKm: number, totalSeconds: number) {
  if (!totalKm || totalKm <= 0) return [];
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

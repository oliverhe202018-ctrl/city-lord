"use server";

import { createClient } from "@/lib/supabase/server";

export async function getRecentActivities(limit: number = 5) {
  // 注意：如果你的 createClient 是异步的(最新版Next.js)，这里可能需要加 await
  // 但根据你提供的代码，我先保持原样，只修语法错误
  const supabase = await createClient(); 

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("Not authenticated");
    return { data: [] };
  }

  try {
    // 1. 查询数据 (保留了你代码中的 runs 表和字段选择)
    const { data, error } = await supabase
      .from("runs")
      .select("id, created_at, area, duration")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching activities from Supabase:", error);
      return { data: [] }; 
    }

    // 2. 数据转换 (保留了你补充 distance: 0 的逻辑)
    // Transform data to match expected interface
    const activities = data.map((run: any) => ({
      ...run,
      distance: 0, // Placeholder as column is missing in schema
    }));

    return { data: activities };

  } catch (error) {
    console.error("Server action unexpected error:", error);
    return { data: [] }; 
  }
}
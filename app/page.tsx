'use client';

import { Suspense, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { GamePageContent } from "@/components/citylord/game-page-content"
import { LoadingScreen } from "@/components/citylord/loading-screen"

export default function CityLordApp() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // 最少展示 2 秒加载屏，让后台定位预取有足够时间
        const minLoadingDelay = new Promise<void>(resolve => setTimeout(resolve, 2000));
        const supabase = createClient();
        // Add timeout to prevent hanging (5s)
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), 5000)
        );

        const authPromise = supabase.auth.getUser();

        // 并行: auth 检查 + 2 秒最低延时
        const [result] = await Promise.all([
          Promise.race([authPromise, timeoutPromise]),
          minLoadingDelay
        ]);
        const { data: { user }, error } = result;

        if (error) {
          console.warn("Auth check warning:", error.message);
        }
        setUser(user);
      } catch (e) {
        console.error("Auth init exception:", e);
        // On error/timeout, assume no user (show login)
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <GamePageContent
        initialUser={user}
      />
    </Suspense>
  );
}

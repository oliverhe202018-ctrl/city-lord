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
        const supabase = createClient();
        // Add timeout to prevent hanging (5s)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth check timeout')), 5000)
        );
        
        const authPromise = supabase.auth.getUser();
        
        // Race between auth check and timeout
        const result = await Promise.race([authPromise, timeoutPromise]) as any;
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

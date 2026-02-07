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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
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

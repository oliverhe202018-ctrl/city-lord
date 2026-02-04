
import { Suspense } from "react"
import { cookies } from 'next/headers'
import { createClient } from "@/lib/supabase/server"
import { fetchUserMissions } from "@/app/actions/mission"
import { getUserProfileStats } from "@/app/actions/user"
import { getFactionStats } from "@/app/actions/faction"
import { fetchUserBadges } from "@/app/actions/badge"
import { fetchFriends, getFriendRequests } from "@/app/actions/social"
import { GamePageContent } from "@/components/citylord/game-page-content"
import { LoadingScreen } from "@/components/citylord/loading-screen"
import { DataPrefetcher } from "@/components/citylord/DataPrefetcher"

export const dynamic = 'force-dynamic';

export default async function CityLordApp() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // Parallel Fetching: User, Missions, Stats, FactionStats, Badges, Social
  // We perform this on the server to reduce client-side waterfalls and redundant requests
  const { data: { session } } = await supabase.auth.getSession()
  
  let initialMissions: any[] = []
  let initialStats: any = null
  let initialFactionStats: any = null
  let initialUser: any = null
  let initialBadges: any[] = []
  let initialFriends: any[] = []
  let initialFriendRequests: any[] = []

  if (session) {
      initialUser = session.user
      try {
        const [missions, stats, factionStats, badges, friends, friendRequests] = await Promise.all([
            fetchUserMissions(),
            getUserProfileStats(),
            getFactionStats(),
            fetchUserBadges(),
            fetchFriends(),
            getFriendRequests()
        ])
        initialMissions = missions
        initialStats = stats
        initialFactionStats = factionStats
        initialBadges = badges
        initialFriends = friends
        initialFriendRequests = friendRequests
      } catch (e) {
        console.error("Error fetching initial data:", e)
      }
  } else {
      // Even if not logged in, we might want faction stats for the landing page/demo
      try {
          initialFactionStats = await getFactionStats()
      } catch (e) {
          console.error("Error fetching faction stats:", e)
      }
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      {/* 
        Prefetch data in background for instant transitions.
        Only render if user is logged in to avoid 401s on API routes.
      */}
      {session && <DataPrefetcher />}
      
      <GamePageContent 
          initialMissions={initialMissions} 
          initialStats={initialStats} 
          initialFactionStats={initialFactionStats}
          initialBadges={initialBadges}
          initialFriends={initialFriends}
          initialFriendRequests={initialFriendRequests}
          initialUser={initialUser} 
      />
    </Suspense>
  )
}

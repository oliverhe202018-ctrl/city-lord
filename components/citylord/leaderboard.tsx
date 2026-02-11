"use client"

import { Trophy, Crown, Medal, Award, Hexagon, Users } from "lucide-react"
import { formatAreaFromHexCount } from "@/lib/citylord/area-utils"
import { GlassCard } from "@/components/ui/GlassCard"
import { useContext } from "react"
import { CityContext } from "@/contexts/CityContext"
import { CityLeaderboardEntry, fetchCityLeaderboard } from "@/app/actions/city"
import useSWR from "swr"

function PodiumItem({ entry, size }: { entry?: CityLeaderboardEntry, size: 'lg' | 'md' | 'sm' }) {
  if (!entry) return null
  const isFirst = entry.rank === 1
  const height = isFirst ? 'h-32' : entry.rank === 2 ? 'h-24' : 'h-20'
  const color = isFirst ? 'text-yellow-400' : entry.rank === 2 ? 'text-gray-300' : 'text-amber-600'
  const glow = isFirst ? 'shadow-[0_0_20px_rgba(250,204,21,0.3)]' : ''

  return (
    <div className="flex flex-col items-center justify-end">
      <div className="relative mb-2">
        {isFirst && <Crown className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 w-6 text-yellow-400 animate-bounce" />}
        <div className={`rounded-full border-2 ${color.replace('text', 'border')} ${glow} p-1`}>
           <div className={`flex items-center justify-center rounded-full bg-white/10 overflow-hidden ${isFirst ? 'h-16 w-16' : 'h-12 w-12'} shrink-0`}>
             {entry.avatar ? (
               <img src={entry.avatar} alt={entry.nickname} className="h-full w-full object-cover" />
             ) : (
               <span className={isFirst ? 'text-3xl' : 'text-2xl'}>👤</span>
             )}
           </div>
        </div>
        <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-black ${color.replace('text', 'bg')}`}>
          {entry.rank}
        </div>
      </div>
      <div className="text-center">
        <div className={`font-bold text-white ${isFirst ? 'text-sm' : 'text-xs'} truncate max-w-[80px]`}>{entry.nickname}</div>
        <div className="text-[10px] text-white/60">{formatAreaFromHexCount(entry.tilesCaptured).fullText}</div>
      </div>
      <div className={`w-full ${height} mt-2 rounded-t-lg bg-gradient-to-b from-white/10 to-transparent backdrop-blur-sm border-t border-x border-white/10`} />
    </div>
  )
}

function Podium({ top3 }: { top3: CityLeaderboardEntry[] }) {
  const [first, second, third] = [
    top3.find(p => p.rank === 1),
    top3.find(p => p.rank === 2),
    top3.find(p => p.rank === 3)
  ]

  return (
    <div className="flex items-end justify-center gap-4 px-4 pt-8 pb-4">
      <div className="flex-1 max-w-[100px] order-1"><PodiumItem entry={second} size="md" /></div>
      <div className="flex-1 max-w-[120px] order-2 z-10 -mb-2"><PodiumItem entry={first} size="lg" /></div>
      <div className="flex-1 max-w-[100px] order-3"><PodiumItem entry={third} size="sm" /></div>
    </div>
  )
}

export function Leaderboard() {
  const context = useContext(CityContext)
  const currentCity = context?.currentCity
  const currentCityProgress = context?.currentCityProgress
  
  // SWR Optimization: Fetch leaderboard independently with caching
  // We use context.leaderboard as fallbackData if available (from initial context load)
  const { data: leaderboardData = [] } = useSWR(
    currentCity?.id ? ['cityLeaderboard', currentCity.id] : null,
    () => fetchCityLeaderboard(currentCity!.id),
    {
      fallbackData: context?.leaderboard || [],
      revalidateOnFocus: true,
      dedupingInterval: 60000 // 1 minute dedupe
    }
  )

  if (!context) {
    return <div className="p-8 text-center text-white/60">Loading...</div>
  }

  const title = currentCity ? `${currentCity.name} 排行榜` : "全球 排行榜"

  const top3 = leaderboardData.filter(e => e.rank <= 3)
  const rest = leaderboardData.filter(e => e.rank > 3)

  return (
    <div className="flex h-full flex-col bg-[#0f172a]">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="text-sm text-white/60">领地占领者排名</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#39ff14]/30 bg-[#39ff14]/10 px-3 py-1.5">
            <Trophy className="h-4 w-4 text-[#39ff14]" />
            <span className="text-sm font-medium text-[#39ff14]">第4赛季</span>
          </div>
        </div>

        {/* Podium */}
        <Podium top3={top3} />
      </div>

      {/* Leaderboard List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 bg-black/20 rounded-t-3xl border-t border-white/10 pt-4">
        {/* Your Rank Card */}
        {currentCityProgress && (
          <GlassCard className="mb-4 p-3 bg-[#39ff14]/5 border-[#39ff14]/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#39ff14]/20 text-[#39ff14] font-bold">
                  {/* Try to find user in leaderboard to get rank, else show '?' */}
                  {leaderboardData.find(e => e.userId === currentCityProgress.userId)?.rank || "?"}
                </div>
                <div>
                  <p className="font-bold text-white">你</p>
                  <p className="text-xs text-white/60">继续占领更多领地！</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#39ff14]">{formatAreaFromHexCount(currentCityProgress.tilesCaptured || 0).value}</p>
                <p className="text-xs text-white/40">{formatAreaFromHexCount(currentCityProgress.tilesCaptured || 0).unit}</p>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="space-y-2">
          {rest.map((entry) => (
            <div
              key={entry.rank}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition-all hover:bg-white/10"
            >
              {/* Rank Badge */}
              <div className="flex w-8 items-center justify-center text-sm font-bold text-white/40">
                #{entry.rank}
              </div>

              {/* Avatar */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl overflow-hidden shrink-0">
                {entry.avatar ? (
                  <img src={entry.avatar} alt={entry.nickname} className="w-full h-full object-cover" />
                ) : (
                  <span>👤</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{entry.nickname}</p>
                </div>
              </div>

              {/* Area Display */}
              <div className="text-right">
                {(() => {
                  const area = formatAreaFromHexCount(entry.tilesCaptured)
                  return (
                    <>
                      <div className="flex items-center justify-end gap-1 text-white">
                        <Hexagon className="h-3 w-3 text-[#39ff14]" />
                        <span className="font-bold">{area.value}</span>
                      </div>
                      <p className="text-[10px] text-white/40">{area.unit}</p>
                    </>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

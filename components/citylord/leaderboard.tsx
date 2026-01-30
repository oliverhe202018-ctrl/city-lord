"use client"

import { Trophy, Crown, Medal, Award, Hexagon, Users } from "lucide-react"
import { formatAreaFromHexCount } from "@/lib/citylord/area-utils"
import { GlassCard } from "@/components/ui/GlassCard"
import { useRegion } from "@/contexts/RegionContext"
import { useState, useEffect } from "react"

interface LeaderboardEntry {
  rank: number
  name: string
  avatar: string
  hexCount: number
  clan: string
}

// 模拟一个更长的排行榜数据
const mockLeaderboardData: { [key: string]: LeaderboardEntry[] } = {
  "beijing": [
    { rank: 1, name: "京城夜行者", avatar: "🏃", hexCount: 950, clan: "NEON" },
    { rank: 2, name: "CyberStrid京", avatar: "⚡", hexCount: 823, clan: "VOLT" },
    { rank: 3, name: "GridMaster京", avatar: "🌐", hexCount: 798, clan: "GRID" },
    { rank: 4, name: "紫禁之巅", avatar: "👑", hexCount: 642, clan: "APEX" },
    { rank: 5, name: "三里屯潮人", avatar: "🌑", hexCount: 589, clan: "DARK" },
    { rank: 6, name: "Velocity京", avatar: "🚀", hexCount: 521, clan: "NEON" },
    { rank: 7, name: "You", avatar: "🎯", hexCount: 487, clan: "VOLT" },
    { rank: 8, name: "Pixel京", avatar: "🎮", hexCount: 456, clan: "GRID" },
    { rank: 9, name: "NeonBlaze京", avatar: "🔥", hexCount: 412, clan: "APEX" },
    { rank: 10, name: "ByteDash京", avatar: "💾", hexCount: 389, clan: "DARK" },
    { rank: 11, name: "Runner11", avatar: "🧑", hexCount: 350, clan: "NEON" },
    { rank: 12, name: "Runner12", avatar: "👩", hexCount: 340, clan: "VOLT" },
    { rank: 13, name: "Runner13", avatar: "👨", hexCount: 330, clan: "GRID" },
    { rank: 14, name: "Runner14", avatar: "👵", hexCount: 320, clan: "APEX" },
    { rank: 15, name: "Runner15", avatar: "👴", hexCount: 310, clan: "DARK" },
    { rank: 16, name: "Runner16", avatar: "🧒", hexCount: 300, clan: "NEON" },
    { rank: 17, name: "Runner17", avatar: "🧓", hexCount: 290, clan: "VOLT" },
    { rank: 18, name: "Runner18", avatar: "🧔", hexCount: 280, clan: "GRID" },
    { rank: 19, name: "Runner19", avatar: "👱", hexCount: 270, clan: "APEX" },
    { rank: 20, name: "Runner20", avatar: "👲", hexCount: 260, clan: "DARK" },
  ],
  "chaoyang": [
    { rank: 1, name: "朝阳跑者", avatar: "😎", hexCount: 500, clan: "NEON" },
    { rank: 2, name: "国贸精英", avatar: "💼", hexCount: 450, clan: "VOLT" },
    { rank: 3, name: "望京SOHO", avatar: "🏢", hexCount: 400, clan: "GRID" },
    { rank: 4, name: "798艺术家", avatar: "🎨", hexCount: 350, clan: "APEX" },
    { rank: 5, name: "You", avatar: "🎯", hexCount: 300, clan: "DARK" },
    { rank: 6, name: "亮马河畔", avatar: "🌊", hexCount: 280, clan: "NEON" },
    { rank: 7, name: "奥森公园", avatar: "🌳", hexCount: 260, clan: "VOLT" },
    { rank: 8, name: "日坛使者", avatar: " Diplomate", hexCount: 240, clan: "GRID" },
    { rank: 9, name: "蓝港潮人", avatar: "🛍️", hexCount: 220, clan: "APEX" },
    { rank: 10, name: "红领巾侠", avatar: "🧣", hexCount: 200, clan: "DARK" },
    { rank: 11, name: "朝阳群众11", avatar: "👀", hexCount: 190, clan: "NEON" },
    { rank: 12, name: "朝阳群众12", avatar: "👀", hexCount: 180, clan: "VOLT" },
    { rank: 13, name: "朝阳群众13", avatar: "👀", hexCount: 170, clan: "GRID" },
    { rank: 14, name: "朝阳群众14", avatar: "👀", hexCount: 160, clan: "APEX" },
    { rank: 15, name: "朝阳群众15", avatar: "👀", hexCount: 150, clan: "DARK" },
    { rank: 16, name: "朝阳群众16", avatar: "👀", hexCount: 140, clan: "NEON" },
    { rank: 17, name: "朝阳群众17", avatar: "👀", hexCount: 130, clan: "VOLT" },
    { rank: 18, name: "朝阳群众18", avatar: "👀", hexCount: 120, clan: "GRID" },
    { rank: 19, name: "朝阳群众19", avatar: "👀", hexCount: 110, clan: "APEX" },
    { rank: 20, name: "朝阳群众20", avatar: "👀", hexCount: 100, clan: "DARK" },
  ],
  "default": [
    { rank: 1, name: "NightRunner", avatar: "🏃", hexCount: 847, clan: "NEON" },
    { rank: 2, name: "CyberStride", avatar: "⚡", hexCount: 723, clan: "VOLT" },
    { rank: 3, name: "GridMaster", avatar: "🌐", hexCount: 698, clan: "GRID" },
    { rank: 4, name: "TerraKing", avatar: "👑", hexCount: 542, clan: "APEX" },
    { rank: 5, name: "ShadowPace", avatar: "🌑", hexCount: 489, clan: "DARK" },
    { rank: 6, name: "VelocityX", avatar: "🚀", hexCount: 421, clan: "NEON" },
    { rank: 7, name: "You", avatar: "🎯", hexCount: 387, clan: "VOLT" },
    { rank: 8, name: "PixelRunner", avatar: "🎮", hexCount: 356, clan: "GRID" },
    { rank: 9, name: "NeonBlaze", avatar: "🔥", hexCount: 312, clan: "APEX" },
    { rank: 10, name: "ByteDash", avatar: "💾", hexCount: 289, clan: "DARK" },
    { rank: 11, name: "Runner11", avatar: "🧑", hexCount: 250, clan: "NEON" },
    { rank: 12, name: "Runner12", avatar: "👩", hexCount: 240, clan: "VOLT" },
    { rank: 13, name: "Runner13", avatar: "👨", hexCount: 230, clan: "GRID" },
    { rank: 14, name: "Runner14", avatar: "👵", hexCount: 220, clan: "APEX" },
    { rank: 15, name: "Runner15", avatar: "👴", hexCount: 210, clan: "DARK" },
    { rank: 16, name: "Runner16", avatar: "🧒", hexCount: 200, clan: "NEON" },
    { rank: 17, name: "Runner17", avatar: "🧓", hexCount: 190, clan: "VOLT" },
    { rank: 18, name: "Runner18", avatar: "🧔", hexCount: 180, clan: "GRID" },
    { rank: 19, name: "Runner19", avatar: "👱", hexCount: 170, clan: "APEX" },
    { rank: 20, name: "Runner20", avatar: "👲", hexCount: 160, clan: "DARK" },
  ]
};

function getClanColor(clan: string) {
  switch (clan) {
    case "NEON":
      return "bg-[#39ff14]/20 text-[#39ff14] border-[#39ff14]/30"
    case "VOLT":
      return "bg-yellow-400/20 text-yellow-400 border-yellow-400/30"
    case "GRID":
      return "bg-cyan-400/20 text-cyan-400 border-cyan-400/30"
    case "APEX":
      return "bg-purple-400/20 text-purple-400 border-purple-400/30"
    case "DARK":
      return "bg-red-400/20 text-red-400 border-red-400/30"
    default:
      return "bg-white/10 text-white/60 border-white/20"
  }
}

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  const [first, second, third] = [
    top3.find(p => p.rank === 1),
    top3.find(p => p.rank === 2),
    top3.find(p => p.rank === 3)
  ]

  const PodiumItem = ({ entry, size }: { entry?: LeaderboardEntry, size: 'lg' | 'md' | 'sm' }) => {
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
             <div className={`flex items-center justify-center rounded-full bg-white/10 ${isFirst ? 'h-16 w-16 text-3xl' : 'h-12 w-12 text-2xl'}`}>
               {entry.avatar}
             </div>
          </div>
          <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-black ${color.replace('text', 'bg')}`}>
            {entry.rank}
          </div>
        </div>
        <div className="text-center">
          <div className={`font-bold text-white ${isFirst ? 'text-sm' : 'text-xs'} truncate max-w-[80px]`}>{entry.name}</div>
          <div className="text-[10px] text-white/60">{formatAreaFromHexCount(entry.hexCount).fullText}</div>
        </div>
        <div className={`w-full ${height} mt-2 rounded-t-lg bg-gradient-to-b from-white/10 to-transparent backdrop-blur-sm border-t border-x border-white/10`} />
      </div>
    )
  }

  return (
    <div className="flex items-end justify-center gap-4 px-4 pt-8 pb-4">
      <div className="flex-1 max-w-[100px] order-1"><PodiumItem entry={second} size="md" /></div>
      <div className="flex-1 max-w-[120px] order-2 z-10 -mb-2"><PodiumItem entry={first} size="lg" /></div>
      <div className="flex-1 max-w-[100px] order-3"><PodiumItem entry={third} size="sm" /></div>
    </div>
  )
}

export function Leaderboard() {
  const { region } = useRegion()
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(mockLeaderboardData['default'])
  const [title, setTitle] = useState("全球 排行榜")

  useEffect(() => {
    // 模拟API调用
    let key = 'default';
    let currentTitle = "全球";

    if (region) {
      if (region.regionType === 'county' && region.adcode?.startsWith('110105')) { // 朝阳
        key = 'chaoyang';
        currentTitle = region.countyName || "朝阳区";
      } else if (region.regionType === 'city' && region.adcode?.startsWith('11')) { // 北京
        key = 'beijing';
        currentTitle = region.cityName || "北京市";
      }
    }

    setTitle(`${currentTitle} 排行榜`);
    setLeaderboardData(mockLeaderboardData[key] || mockLeaderboardData['default']);
  }, [region])


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
        <GlassCard className="mb-4 p-3 bg-[#39ff14]/5 border-[#39ff14]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#39ff14]/20 text-[#39ff14] font-bold">
                #7
              </div>
              <div>
                <p className="font-bold text-white">你 (NightHunter)</p>
                <p className="text-xs text-white/60">再占领 35 个领地可超越上一名</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#39ff14]">{formatAreaFromHexCount(387).value}</p>
              <p className="text-xs text-white/40">{formatAreaFromHexCount(387).unit}</p>
            </div>
          </div>
        </GlassCard>

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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">
                {entry.avatar}
              </div>

              {/* Name & Clan */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">{entry.name}</p>
                  <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium border ${getClanColor(entry.clan)}`}>
                    {entry.clan}
                  </span>
                </div>
              </div>

              {/* Area Display */}
              <div className="text-right">
                {(() => {
                  const area = formatAreaFromHexCount(entry.hexCount)
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

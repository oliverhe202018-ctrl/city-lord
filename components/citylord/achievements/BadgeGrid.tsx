"use client"

import React, { useState } from "react"
import { Lock, Award, Trophy, Zap, Swords, MapPin, Footprints, Star } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Image from "next/image"
import { useUserBadges } from "@/hooks/useGameData"
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements"
import { useCity } from "@/contexts/CityContext"

export function BadgeGrid() {
  const { currentCity } = useCity()
  const { data: earnedBadgeIds } = useUserBadges()
  const [selectedBadge, setSelectedBadge] = useState<any | null>(null)
  const [imgError, setImgError] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>("all")

  const categories = [
    { id: "all", label: "全部", icon: Trophy },
    { id: "speed", label: "速度", icon: Zap },
    { id: "conquest", label: "征服", icon: Swords },
    { id: "exploration", label: "探索", icon: MapPin },
    { id: "endurance", label: "耐力", icon: Footprints },
    { id: "special", label: "特殊", icon: Star },
  ]

  const filteredBadges = ACHIEVEMENT_DEFINITIONS.filter(badge => 
    activeCategory === "all" || badge.category === activeCategory
  )

  const isUnlocked = (badgeId: string) => {
    return Array.isArray(earnedBadgeIds) && earnedBadgeIds.includes(badgeId)
  }

  const getTierColor = (tier: string = 'common') => {
    switch (tier) {
      case 'common': return 'text-orange-400 border-orange-400/50 bg-orange-400/10'
      case 'rare': return 'text-cyan-400 border-cyan-400/50 bg-gradient-to-br from-cyan-400/10 to-cyan-400/20 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
      case 'epic': return 'text-yellow-400 border-yellow-400/50 bg-gradient-to-br from-yellow-400/10 to-yellow-400/20 shadow-[0_0_15px_rgba(250,204,21,0.3)] ring-1 ring-yellow-400/30'
      case 'legendary': return 'text-purple-400 border-purple-400/50 bg-gradient-to-br from-purple-400/10 to-purple-400/20 shadow-[0_0_20px_rgba(192,132,252,0.4)] ring-1 ring-purple-400/30'
      default: return 'text-gray-400 border-gray-400/50 bg-gray-400/10'
    }
  }

  const getTierLabel = (tier: string = 'common') => {
    const map: Record<string, string> = {
      common: '普通',
      rare: '稀有',
      epic: '史诗',
      legendary: '传奇'
    }
    return map[tier] || tier
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Category Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/20 p-1 no-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={isActive && currentCity ? {
                  backgroundColor: `${currentCity.theme.primary}15`,
                  color: currentCity.theme.primary,
                  borderColor: `${currentCity.theme.primary}30`
              } : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap border border-transparent ${
                isActive
                  ? "shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {filteredBadges.map((badge) => {
          const unlocked = isUnlocked(badge.id)
          const tierColor = getTierColor(badge.rarity)
          const hasError = imgError[badge.id]

          return (
            <div
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className={`
                relative aspect-[4/5] rounded-xl border p-2 flex flex-col items-center justify-between
                transition-all duration-200 active:scale-95 touch-none select-none
                ${unlocked
                  ? `${tierColor}`
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 grayscale'}
              `}
            >
               <div className="flex-1 flex items-center justify-center w-full relative">
                  {badge.image && !hasError ? (
                    <div className="relative w-12 h-12">
                      <Image
                        src={badge.image}
                        alt={badge.title}
                        fill
                        className="object-contain"
                        onError={() => setImgError(prev => ({ ...prev, [badge.id]: true }))}
                      />
                    </div>
                  ) : (
                    <Award className="w-10 h-10 opacity-50" />
                  )}
                  
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-[1px]">
                      <Lock className="w-5 h-5 text-white/70" />
                    </div>
                  )}
               </div>
               
               <div className="w-full text-center space-y-0.5">
                 <div className="text-xs font-bold truncate px-1">{badge.title}</div>
                 <div className="text-[10px] opacity-70 uppercase tracking-wider">{getTierLabel(badge.rarity)}</div>
               </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white w-[90%] max-w-sm rounded-2xl">
          {selectedBadge && (
            <div className="flex flex-col items-center text-center space-y-4 pt-4">
              <div className={`
                w-24 h-24 rounded-full flex items-center justify-center border-2 mb-2
                ${isUnlocked(selectedBadge.id) ? getTierColor(selectedBadge.rarity).replace('text-', 'border-') : 'border-zinc-700 bg-zinc-900'}
              `}>
                  <div className="relative w-16 h-16">
                    {selectedBadge.image && (
                      <Image
                        src={selectedBadge.image}
                        alt={selectedBadge.title}
                        fill
                        className={`object-contain ${!isUnlocked(selectedBadge.id) ? 'grayscale opacity-50' : ''}`}
                      />
                    )}
                  </div>
              </div>
              
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-bold flex flex-col gap-1 items-center">
                  <span>{selectedBadge.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierColor(selectedBadge.rarity)}`}>
                    {getTierLabel(selectedBadge.rarity)}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-zinc-400 text-base">
                  {selectedBadge.description}
                </DialogDescription>
              </DialogHeader>

              {isUnlocked(selectedBadge.id) ? (
                <div className="w-full bg-green-500/10 text-green-400 py-2 rounded-lg text-sm font-medium border border-green-500/20">
                  已解锁
                </div>
              ) : (
                <div className="w-full text-xs text-zinc-500">
                   完成特定任务以解锁
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

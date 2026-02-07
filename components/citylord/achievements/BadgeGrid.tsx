"use client"

import React, { useEffect, useState } from "react"
import { Lock, Award } from "lucide-react"
import { Badge, UserBadge } from "@/app/actions/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BadgeIcon } from "./badge-icon"
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements"
import Image from "next/image"
import { toast } from "sonner"
import { useGameStore } from "@/store/useGameStore"
import { useUserBadges } from "@/hooks/useGameData"
import { format } from "date-fns"

interface BadgeGridProps {
  initialData?: any[]
}

export function BadgeGrid({ initialData }: BadgeGridProps) {
  // Use ACHIEVEMENT_DEFINITIONS as the source of truth for badges list
  const badges = ACHIEVEMENT_DEFINITIONS
  const { userId, userStats } = useGameStore()
  
  const { data: userBadges, isLoading: loading } = useUserBadges()
  
  // Manual coalesce with initialData
  const currentBadges = userBadges || initialData || []
  const isLoading = loading && !userBadges && !initialData

  const [selectedBadge, setSelectedBadge] = useState<any | null>(null) // Use any to allow mixing types if needed, or update Badge type

  const isUnlocked = (badgeId: string) => {
    return (currentBadges || []).some((ub: any) => ub.badge_id === badgeId)
  }

  const getProgress = (badge: any) => {
    if (isUnlocked(badge.id)) return null
    if (badge.category === 'special') return null

    let current = 0
    let target = badge.maxProgress
    let unit = ''

    if (badge.category === 'territory') {
        // Handle exploration/conquest logic roughly
        if (badge.id.includes('exploration')) {
            // Count badges
            // Assuming this maps to tiles for simplicity as per description
            current = userStats?.totalTiles || 0
            unit = '块'
        } else if (badge.id.includes('conquest')) {
            // Area
             current = userStats?.totalArea || 0
             unit = 'km²'
        } else {
             current = userStats?.totalTiles || 0
             unit = '块'
        }
    } else if (badge.category === 'running') {
        current = userStats?.totalDistance || 0
        unit = 'km'
    }

    if (target <= 0) return null
    const percentage = Math.min(100, Math.round((current / target) * 100))
    
    return { current, target, percentage, unit }
  }

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'common': return '普通'
      case 'rare': return '稀有'
      case 'epic': return '史诗'
      case 'legendary': return '传说'
      // Fallback for legacy
      case 'bronze': return '青铜'
      case 'silver': return '白银'
      case 'gold': return '黄金'
      case 'platinum': return '铂金'
      case 'diamond': return '钻石'
      default: return '普通'
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'territory': return '领地'
      case 'running': return '跑步'
      case 'special': return '特殊'
      // Fallback/UI Mapping
      case 'exploration': return '探索'
      case 'endurance': return '耐力'
      case 'conquest': return '征服'
      case 'hidden': return '隐藏'
      default: return '其他'
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'common': 
      case 'bronze': return 'text-orange-400 border-orange-400/50 bg-orange-400/10'
      
      case 'rare':
      case 'silver': return 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10' // Blue/Cyan for Rare
      
      case 'epic':
      case 'gold': return 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10' // Gold for Epic
      
      case 'legendary': return 'text-purple-400 border-purple-400/50 bg-purple-400/10' // Purple for Legendary
      
      case 'platinum': return 'text-teal-400 border-teal-400/50 bg-teal-400/10'
      case 'diamond': return 'text-blue-400 border-blue-400/50 bg-blue-400/10'
      
      default: return 'text-gray-400 border-gray-400/50 bg-gray-400/10'
    }
  }

  if (isLoading) {
    return <div className="text-center text-white/50 py-8">加载徽章中...</div>
  }

  // Group by category
  const categories = ['exploration', 'endurance', 'conquest', 'hidden']
  
  return (
    <div className="space-y-6">
      {categories.map(category => {
        let categoryBadges: typeof badges = []
        
        if (category === 'exploration') {
          categoryBadges = badges.filter(b => b.category === 'territory' && !b.id.startsWith('conquest'))
        } else if (category === 'endurance') {
          categoryBadges = badges.filter(b => b.category === 'running')
        } else if (category === 'conquest') {
          categoryBadges = badges.filter(b => b.category === 'territory' && b.id.startsWith('conquest'))
        } else if (category === 'hidden') {
          categoryBadges = badges.filter(b => b.category === 'special')
        }

        if (categoryBadges.length === 0) return null

        return (
          <div key={category}>
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 px-2">
              {category === 'exploration' && '探索'}
              {category === 'endurance' && '耐力'}
              {category === 'conquest' && '征服'}
              {category === 'hidden' && '隐藏'}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {categoryBadges.map(badge => {
                const unlocked = isUnlocked(badge.id)
                // Fix: map rarity to tier color, access image directly, map title to name
                const tierClass = getTierColor(badge.rarity)
                const imagePath = badge.image
                const showContent = unlocked || badge.category !== 'special' // hidden category is mapped to 'special' in definitions? No, wait. 
                // Let's check definitions. category is 'territory' | 'running' | 'special'.
                // The 'hidden' tab filters for 'special'.
                // So if badge.category === 'special', we might want to hide it if locked.
                // The loop logic was: if (category === 'hidden') ...
                // So here we want to hide content if it is a special/hidden badge and not unlocked.
                const isHiddenType = badge.category === 'special'
                const shouldShowContent = unlocked || !isHiddenType

                return (
                  <button
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge)}
                    className={`
                      relative aspect-square flex flex-col items-center justify-between rounded-xl border p-2 transition-all overflow-hidden pb-3
                      ${unlocked 
                        ? `${tierClass} hover:bg-white/5` 
                        : 'border-white/5 bg-white/5 hover:opacity-100'
                      }
                    `}
                  >
                    {/* Background image if unlocked or locked (but grayscale) */}
                    {imagePath && shouldShowContent ? (
                      <div className={`absolute inset-x-0 top-0 bottom-6 z-0 p-2 flex items-center justify-center ${!unlocked ? 'grayscale opacity-40' : ''}`}>
                         <div className="relative w-full h-full max-w-[70%] max-h-[70%]">
                           <Image 
                             src={imagePath} 
                             alt={badge.title}
                             fill
                             className="object-contain"
                           />
                         </div>
                      </div>
                    ) : null}

                    <div className={`relative z-10 p-2 rounded-full mt-1 ${unlocked ? 'bg-black/20' : 'bg-black/40'} ${(imagePath && shouldShowContent) ? 'bg-transparent' : ''}`}>
                       {shouldShowContent ? (
                         (imagePath && shouldShowContent) ? <div className="w-6 h-6" /> : <badge.icon className="w-6 h-6" />
                       ) : (
                         <Lock className="w-6 h-6 text-white/30" />
                       )}
                    </div>
                    
                    {/* Progress Bar for locked badges */}
                    {!unlocked && !isHiddenType && (() => {
                        const progress = getProgress(badge)
                        if (progress) {
                            return (
                                <div className="w-full px-1 my-1 z-20 absolute bottom-6">
                                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                        <div className="h-full bg-yellow-500/50" style={{ width: `${progress.percentage}%` }} />
                                    </div>
                                    <div className="text-[8px] text-center text-white/40 mt-0.5 scale-90">
                                        {progress.current}/{progress.target}{progress.unit}
                                    </div>
                                </div>
                            )
                        }
                        return null
                    })()}

                    <span className={`relative z-10 text-[10px] font-medium text-center line-clamp-1 w-full mt-2 ${!unlocked ? 'text-white/40' : ''}`}>
                      {badge.title}
                    </span>
                    
                    {!unlocked && !imagePath && (
                       <div className="absolute inset-0 bg-black/40 z-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <Dialog open={!!selectedBadge} onOpenChange={() => setSelectedBadge(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
               {selectedBadge?.title}
               {isUnlocked(selectedBadge?.id || '') && (
                 <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                   已获得
                 </span>
               )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="flex flex-col items-center justify-center p-6 space-y-4">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br ${
                    selectedBadge?.rarity === 'legendary' ? 'from-orange-500/20 to-red-500/20 border-orange-500/50' :
                    selectedBadge?.rarity === 'epic' ? 'from-purple-500/20 to-pink-500/20 border-purple-500/50' :
                    selectedBadge?.rarity === 'rare' ? 'from-blue-500/20 to-cyan-500/20 border-blue-500/50' :
                    'from-white/10 to-white/5 border-white/20'
                  } border-2 shadow-[0_0_30px_-5px_rgba(0,0,0,0.5)]`}>
                    <BadgeIcon 
                      name={selectedBadge?.icon_name || 'award'} 
                      className={`w-12 h-12 ${
                        isUnlocked(selectedBadge?.id || '') ? 'text-white' : 'text-white/20'
                      }`}
                    />
                  </div>
                  {/* Lock Overlay if locked */}
                  {!isUnlocked(selectedBadge?.id || '') && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full backdrop-blur-[1px]">
                      <Lock className="w-8 h-8 text-white/40" />
                    </div>
                  )}
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold text-white tracking-wide">{selectedBadge?.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed max-w-[260px]">
                    {selectedBadge?.description}
                  </p>
                </div>
             </div>
             
             <div>
                <h4 className="text-sm font-semibold text-white/80 mb-1">获取时间</h4>
                <p className="text-sm text-white/60">
                  {(() => {
                    const userBadge = (userBadges || []).find(ub => ub.badge_id === selectedBadge?.id)
                    if (userBadge?.earned_at) {
                      return format(new Date(userBadge.earned_at), 'yyyy-MM-dd HH:mm')
                    }
                    return "未获得"
                  })()}
                </p>
             </div>

             <div className="flex justify-between items-center text-xs text-white/40 border-t border-white/10 pt-4">
                <span>等级: {getTierLabel(selectedBadge?.rarity || '')}</span>
                <span>类别: {getCategoryLabel(selectedBadge?.category || '')}</span>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

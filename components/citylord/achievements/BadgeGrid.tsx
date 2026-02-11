"use client"

import React, { useEffect, useState } from "react"
import { Lock, Award } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { BadgeIcon } from "./badge-icon"
import Image from "next/image"
import { useGameStore } from "@/store/useGameStore"
import { badgeService } from "@/lib/services/BadgeService"
import { BadgeType } from "@/lib/api/badges"

interface BadgeGridProps {
  initialData?: any[]
}

export function BadgeGrid({ initialData }: BadgeGridProps) {
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>([])
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | null>(null)
  
  const { userId, totalArea, totalDistance } = useGameStore()
  
  // Create a compatibility object or use fields directly
  const userStats = {
    totalArea: totalArea || 0,
    totalDistance: totalDistance || 0,
    totalTiles: 0 // Placeholder as it's not in store
  }

  useEffect(() => {
    let mounted = true

    async function loadData() {
      // Load badge definitions first (can be done without user)
      try {
        const types = await badgeService.getAllBadgeTypes()
        if (mounted) {
          setBadgeTypes(types)
        }
        
        // If we have a user, load their earned badges
        if (userId) {
          const earned = await badgeService.getUserEarnedBadgeIds(userId)
          if (mounted) {
            setEarnedBadgeIds(earned)
          }
        }
      } catch (error) {
        console.error("Failed to load badges:", error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }
    
    loadData()

    return () => {
      mounted = false
    }
  }, [userId])

  const isUnlocked = (badgeId: string) => earnedBadgeIds.has(badgeId)

  const getProgress = (badge: BadgeType) => {
    if (isUnlocked(badge.id)) return null
    if (badge.category === 'special') return null

    // Default to 0 if no stats available
    let current = 0
    let target = badge.condition_value || badge.requirement_value || 0
    let unit = ''

    // Logic to map badge requirements to user stats
    // This needs to match how the backend calculates progress or use client-side approximation
    // For now, we'll try to map common requirement types based on category
    
    const cat = badge.category.toLowerCase()
    
    if (cat === 'exploration' || cat === 'territory') {
       if (badge.code.includes('explorer')) { // e.g. visit districts
          current = userStats?.totalTiles || 0 // Proxy
          unit = 'districts'
       } else {
          current = userStats?.totalTiles || 0
          unit = 'tiles'
       }
    } else if (cat === 'endurance' || cat === 'running') {
        current = (userStats?.totalDistance || 0) / 1000 // Convert m to km if stored in m
        if (target > 1000) { // If target looks like meters
            current = userStats?.totalDistance || 0
            unit = 'm'
        } else {
            unit = 'km'
        }
    } else if (cat === 'speed') {
        // Speed logic is harder to track incrementally on profile without specific stats
        return null
    } else if (cat === 'conquest') {
         current = userStats?.totalArea || 0
         unit = 'km²'
    }

    if (target <= 0) return null
    const percentage = Math.min(100, Math.round((current / target) * 100))
    
    return { current: current.toFixed(1), target, percentage, unit }
  }

  const getTierColor = (tier: string) => {
    const t = tier.toLowerCase()
    switch (t) {
      case 'bronze': 
      case 'common': return 'text-orange-400 border-orange-400/50 bg-orange-400/10'
      
      case 'silver': 
      case 'rare': return 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10'
      
      case 'gold': 
      case 'epic': return 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10'
      
      case 'platinum': 
      case 'legendary': return 'text-purple-400 border-purple-400/50 bg-purple-400/10'
      
      case 'diamond': return 'text-blue-400 border-blue-400/50 bg-blue-400/10'
      
      default: return 'text-gray-400 border-gray-400/50 bg-gray-400/10'
    }
  }

  const getTierLabel = (tier: string) => {
    const t = tier.toLowerCase()
    switch (t) {
      case 'bronze': return '青铜'
      case 'silver': return '白银'
      case 'gold': return '黄金'
      case 'platinum': return '铂金'
      case 'diamond': return '钻石'
      case 'common': return '普通'
      case 'rare': return '稀有'
      case 'epic': return '史诗'
      case 'legendary': return '传说'
      default: return tier
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (badgeTypes.length === 0) {
    return <div className="text-center text-white/50 py-8">暂无徽章数据</div>
  }

  // Group by category
  // Get unique categories from data
  const categories = Array.from(new Set(badgeTypes.map(b => b.category)))
    .sort((a, b) => {
      // Optional: fixed order for common categories
      const order = ['Exploration', 'Endurance', 'Conquest', 'Speed', 'Special']
      const indexA = order.indexOf(a)
      const indexB = order.indexOf(b)
      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return a.localeCompare(b)
    })

  // Helper to resolve badge image URL
  const resolveBadgeUrl = (url: string | null | undefined) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('/')) return url;
    return `/badges/${url}`;
  }

  return (
    <div className="space-y-8 pb-20">
      {categories.map(category => {
        const categoryBadges = badgeTypes.filter(b => b.category === category)
        if (categoryBadges.length === 0) return null

        return (
          <div key={category} className="space-y-3">
            <h3 className="text-lg font-bold text-white px-1 capitalize">{category}</h3>
            <div className="grid grid-cols-3 gap-3">
              {categoryBadges.map((badge) => {
                const unlocked = isUnlocked(badge.id)
                const tierColor = getTierColor(badge.tier)
                const resolvedUrl = resolveBadgeUrl(badge.icon_url)
                
                return (
                  <div 
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge)}
                    className={`
                      relative aspect-[4/5] rounded-xl border p-2 flex flex-col items-center justify-between
                      transition-all duration-200 active:scale-95 touch-none select-none
                      ${unlocked 
                        ? `${tierColor} bg-opacity-10 border-opacity-50 shadow-lg shadow-current/5` 
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-600 grayscale'}
                    `}
                  >
                    <div className="flex-1 flex items-center justify-center w-full relative">
                      {resolvedUrl ? (
                        <div className="relative w-12 h-12">
                          <Image 
                            src={resolvedUrl} 
                            alt={badge.name}
                            fill
                            className="object-contain"
                            onError={(e) => {
                                // Hide image on error by setting opacity to 0 or similar
                                // But since Next.js Image component handles error internally mostly by just failing
                                // We can use a state to track error, but that's complex for a list.
                                // Simple approach: use a fallback if possible, but Image component is tricky.
                                // Let's rely on defensive URL resolution first.
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement?.classList.add('fallback-icon-container');
                            }}
                          />
                          {/* Fallback Icon (shown if image hidden via onError logic or if needed) */}
                          {/* Actually, a cleaner way is to render the icon if resolveUrl is empty. */}
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
                      <div className="text-xs font-bold truncate px-1">{badge.name}</div>
                      <div className="text-[10px] opacity-70 uppercase tracking-wider">{getTierLabel(badge.tier)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <Dialog open={!!selectedBadge} onOpenChange={(open) => !open && setSelectedBadge(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white w-[90%] max-w-sm rounded-2xl">
          {selectedBadge && (
            <div className="flex flex-col items-center text-center space-y-4 pt-4">
              <div className={`
                w-24 h-24 rounded-full flex items-center justify-center border-2 mb-2
                ${isUnlocked(selectedBadge.id) ? getTierColor(selectedBadge.tier).replace('text-', 'border-') : 'border-zinc-700 bg-zinc-900'}
              `}>
                 {resolveBadgeUrl(selectedBadge.icon_url) ? (
                    <div className="relative w-16 h-16">
                      <Image 
                        src={resolveBadgeUrl(selectedBadge.icon_url)} 
                        alt={selectedBadge.name}
                        fill
                        className={`object-contain ${!isUnlocked(selectedBadge.id) ? 'grayscale opacity-50' : ''}`}
                      />
                    </div>
                  ) : (
                    <Award className={`w-12 h-12 ${!isUnlocked(selectedBadge.id) ? 'text-zinc-600' : 'text-white'}`} />
                  )}
              </div>
              
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-bold flex flex-col gap-1 items-center">
                  <span>{selectedBadge.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getTierColor(selectedBadge.tier)}`}>
                    {getTierLabel(selectedBadge.tier)}
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
                <div className="w-full space-y-2">
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                    {(() => {
                      const progress = getProgress(selectedBadge)
                      if (!progress) return <div className="w-full h-full bg-zinc-800" />
                      return (
                         <div 
                           className="h-full bg-primary transition-all duration-500" 
                           style={{ width: `${progress.percentage}%` }}
                         />
                      )
                    })()}
                  </div>
                  {(() => {
                    const progress = getProgress(selectedBadge)
                    if (progress) {
                        return (
                             <div className="flex justify-between text-xs text-zinc-500">
                                <span>进度</span>
                                <span>{progress.current} / {progress.target} {progress.unit}</span>
                             </div>
                        )
                    }
                    return <div className="text-xs text-zinc-500">继续努力解锁此徽章</div>
                  })()}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

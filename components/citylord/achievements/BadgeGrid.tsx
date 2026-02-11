"use client"

import React, { useEffect, useState } from "react"
import { Lock, Award } from "lucide-react"
import { Badge, UserBadge } from "@/app/actions/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
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

const STATIC_BADGES = [
  // 探索类 (Exploration)
  { id: 'city-explorer', title: 'City Explorer', description: 'Visit 3 different districts', image: 'badge_city_explorer.png', category: 'Exploration', rarity: 'bronze', maxProgress: 3 },
  { id: 'city-walker', title: 'City Walker', description: 'Walk 10km total', image: 'badge_city_walker.png', category: 'Exploration', rarity: 'bronze', maxProgress: 10000 },
  { id: 'early-bird', title: 'Early Bird', description: 'Complete a run before 7 AM', image: 'badge_early_bird.png', category: 'Exploration', rarity: 'silver', maxProgress: 1 },
  { id: 'night-walker', title: 'Night Walker', description: 'Complete a run after 9 PM', image: 'badge_night_walker.png', category: 'Exploration', rarity: 'silver', maxProgress: 1 },
  
  // 耐力类 (Endurance)
  { id: '100km-club', title: '100km Club', description: 'Total distance > 100km', image: 'badge_100km.png', category: 'Endurance', rarity: 'gold', maxProgress: 100000 },
  { id: 'marathon-god', title: 'Marathon God', description: 'Single run > 42km', image: 'badge_marathon_god.png', category: 'Endurance', rarity: 'platinum', maxProgress: 42000 },
  { id: 'shoe-killer', title: 'Shoe Killer', description: 'Total distance > 500km', image: 'badge_shoe_killer.png', category: 'Endurance', rarity: 'platinum', maxProgress: 500000 },
  
  // 征服类 (Conquest)
  { id: 'first-territory', title: 'First Territory', description: 'Capture 1st territory', image: 'badge_first_territory.png', category: 'Conquest', rarity: 'bronze', maxProgress: 1 },
  { id: 'landlord', title: 'Landlord', description: 'Hold 10 territories simultaneously', image: 'badge_landlord.png', category: 'Conquest', rarity: 'gold', maxProgress: 10 },
  { id: 'territory-raider', title: 'Territory Raider', description: 'Capture 50 territories total', image: 'badge_territory_raider.png', category: 'Conquest', rarity: 'platinum', maxProgress: 50 },
  
  // 速度类 (Speed)
  { id: 'flash', title: 'Flash', description: "Pace < 4'00\"/km for 5km", image: 'badge_flash.png', category: 'Speed', rarity: 'gold', maxProgress: 1 },
  { id: 'wind-chaser', title: 'Wind Chaser', description: 'Top speed > 15km/h', image: 'badge_wind_chaser_gold.png', category: 'Speed', rarity: 'silver', maxProgress: 15 },
  
  // 特殊类 (Special)
  { id: 'social-star', title: 'Social Star', description: 'Invite 5 friends', image: 'badge_starting_line.png', category: 'Special', rarity: 'silver', maxProgress: 5 },
  { id: 'mysterious', title: 'Mysterious', description: 'Hidden achievement', image: 'a-cute-myster...png', category: 'Special', rarity: 'platinum', maxProgress: 1 }
]

export function BadgeGrid({ initialData }: BadgeGridProps) {
  // Use serverBadges + fallback to static if needed, but let's prioritize serverBadges
  // Actually, we want to show ALL possible badges (from DB)
  // If serverBadges only returns unlocked ones, we need a way to get all definitions.
  // The API /api/badges/my only returns earned badges.
  // We need a public API to get all badge definitions OR use static definitions.
  // Since we just seeded the DB, static definitions might be out of sync if we change DB.
  // Ideally, we fetch all definitions from /api/badges/definitions (public).
  
  // For now, let's use the static ACHIEVEMENT_DEFINITIONS but updated to match seed data structure
  // Wait, the seed data uses new structure (Exploration, Speed, etc).
  // The static file might be old.
  // Let's rely on a new fetch for definitions.
  
  const [allBadges, setAllBadges] = useState<any[]>(STATIC_BADGES) 



  
  const { data: userBadgesData, isLoading: loading } = useUserBadges()
  const [serverBadges, setServerBadges] = useState<any[]>([])

  useEffect(() => {
    // Fetch user badges from new API
    fetch('/api/badges/my', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setServerBadges(Array.isArray(data.data) ? data.data : [])
        } else {
          setServerBadges([])
        }
      })
      .catch(err => {
        console.error(err)
        setServerBadges([])
      })
  }, [])
  
  // Use serverBadges + fallback to static if needed, but let's prioritize serverBadges
  // Actually, we want to show ALL possible badges (from DB)
  // If serverBadges only returns unlocked ones, we need a way to get all definitions.
  // The API /api/badges/my only returns earned badges.
  // We need a public API to get all badge definitions OR use static definitions.
  // Since we just seeded the DB, static definitions might be out of sync if we change DB.
  // Ideally, we fetch all definitions from /api/badges/definitions (public).
  
  // Use local definitions as base
  const badges = allBadges
  
  const { userId, userStats } = useGameStore()
  const [selectedBadge, setSelectedBadge] = useState<any>(null)
  
  const isUnlocked = (badgeId: string) => {
    // Check if we have this badge in serverBadges (by code or id)
    // serverBadges contains full badge objects with id, code, etc.
    return serverBadges.some((ub: any) => ub.id === badgeId || ub.code === badgeId)
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
  // Map our new DB categories to UI tabs
  const categories = ['Exploration', 'Endurance', 'Conquest', 'Speed', 'Special']
  
  return (
    <div className="space-y-6">
      {categories.map(category => {
        // Filter badges by category (case insensitive match)
        const categoryBadges = badges.filter(b => b.category.toLowerCase() === category.toLowerCase())

        if (categoryBadges.length === 0) return null

        return (
          <div key={category}>
            <h3 className="text-sm font-bold text-white/60 uppercase tracking-wider mb-3 px-2">
              {category}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {categoryBadges.map(badge => {
                const unlocked = isUnlocked(badge.id)
                // Fix: map rarity to tier color, access image directly, map title to name
                const tierClass = getTierColor(badge.rarity)
                const imagePath = badge.image ? (badge.image.startsWith('/') ? badge.image : `/badges/${badge.image}`) : undefined;
                
                // Show content logic: Always show content, just greyed out if locked.
                // Unless it's hidden and locked.
                const isHiddenType = badge.category.toLowerCase() === 'special' && badge.id === 'mysterious'
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
                             onError={(e) => {
                                 e.currentTarget.src = '/badges/badge_100km.png'; // Fallback to a known image
                                 // e.currentTarget.style.display = 'none'; // Don't hide, show fallback
                             }}
                           />
                           {/* Fallback Icon will show if image is hidden because they are siblings in different containers? 
                               No, the Image is inside a div. If I hide the image, I see the div background. 
                               Actually, if image fails, we should show the Icon fallback.
                               But current structure is: if imagePath exists, show Image.
                               So I need to handle state for image error to switch to Icon.
                               Or just use a simple placeholder. 
                               The user said: "显示一个默认的灰色锁头图标或占位图"
                           */}
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
            <DialogDescription className="sr-only">
              {selectedBadge?.description || "Badge Details"}
            </DialogDescription>
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
                    const userBadge = (Array.isArray(userBadges) ? userBadges : []).find(ub => ub.badge_id === selectedBadge?.id)
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

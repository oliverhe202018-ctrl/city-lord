"use client"

import React, { useEffect, useState } from "react"
import { Lock, Award } from "lucide-react"
import { fetchAllBadges, fetchUserBadges, Badge, UserBadge } from "@/app/actions/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BadgeIcon } from "./badge-icon"

export function BadgeGrid() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [userBadges, setUserBadges] = useState<UserBadge[]>([])
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const [allBadges, myBadges] = await Promise.all([
          fetchAllBadges(),
          fetchUserBadges()
        ])
        setBadges(allBadges)
        setUserBadges(myBadges)
      } catch (e) {
        console.error("Failed to load badges", e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const isUnlocked = (badgeId: string) => {
    return userBadges.some(ub => ub.badge_id === badgeId)
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze': return 'text-orange-400 border-orange-400/50 bg-orange-400/10'
      case 'silver': return 'text-slate-300 border-slate-300/50 bg-slate-300/10'
      case 'gold': return 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10'
      case 'diamond': return 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10'
      case 'platinum': return 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10'
      case 'legendary': return 'text-purple-400 border-purple-400/50 bg-purple-400/10'
      default: return 'text-gray-400 border-gray-400/50 bg-gray-400/10'
    }
  }

  if (loading) {
    return <div className="text-center text-white/50 py-8">加载徽章中...</div>
  }

  // Group by category
  const categories = ['exploration', 'endurance', 'conquest', 'hidden']
  
  return (
    <div className="space-y-6">
      {categories.map(category => {
        const categoryBadges = badges.filter(b => b.category === category)
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
                const tierClass = getTierColor(badge.tier)

                return (
                  <button
                    key={badge.id}
                    onClick={() => setSelectedBadge(badge)}
                    className={`
                      relative aspect-square flex flex-col items-center justify-center rounded-xl border p-2 transition-all
                      ${unlocked 
                        ? `${tierClass} hover:bg-white/5` 
                        : 'border-white/5 bg-white/5 opacity-50 grayscale hover:opacity-70'
                      }
                    `}
                  >
                    <div className={`mb-2 p-2 rounded-full ${unlocked ? 'bg-black/20' : 'bg-black/40'}`}>
                       {(unlocked || badge.category !== 'hidden') ? (
                         <BadgeIcon iconName={badge.icon_name} className="w-6 h-6" />
                       ) : (
                         <Lock className="w-6 h-6 text-white/30" />
                       )}
                    </div>
                    <span className="text-[10px] font-medium text-center line-clamp-1 w-full">
                      {badge.name}
                    </span>
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
               {selectedBadge?.name}
               {isUnlocked(selectedBadge?.id || '') && (
                 <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                   已获得
                 </span>
               )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="flex justify-center py-6 bg-black/20 rounded-lg">
                {selectedBadge && (() => {
                   const tierClass = getTierColor(selectedBadge.tier)
                   return <BadgeIcon iconName={selectedBadge.icon_name} className={`w-24 h-24 ${tierClass.split(' ')[0]}`} />
                })()}
             </div>
             <div>
                <h4 className="text-sm font-semibold text-white/80 mb-1">达成条件</h4>
                <p className="text-sm text-white/60">{selectedBadge?.description}</p>
             </div>
             <div className="flex justify-between items-center text-xs text-white/40 border-t border-white/10 pt-4">
                <span>等级: {selectedBadge?.tier.toUpperCase()}</span>
                <span>类别: {selectedBadge?.category.toUpperCase()}</span>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

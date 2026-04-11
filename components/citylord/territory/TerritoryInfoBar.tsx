'use client'

import { useMapInteraction } from '@/components/map/MapInteractionContext'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { getTerritoryDetail } from '@/app/actions/territory-detail'
import { Loader2, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useGameStore } from '@/store/useGameStore'

export function TerritoryInfoBar() {
    const { selectedTerritory, kingdomMode, setIsDetailSheetOpen } = useMapInteraction()
    const selectedTerritoryId = useGameStore((state) => state.selectedTerritoryId)

    // Use store ID as primary, fallback to context
    const activeId = selectedTerritoryId || selectedTerritory?.id || null
    const isVisible = activeId !== null
    
    const { data: detail, isLoading } = useQuery({
        queryKey: ['territory-detail', activeId],
        queryFn: () => getTerritoryDetail(activeId!, {
            ownerId: selectedTerritory?.ownerId ?? undefined,
            clubId: selectedTerritory?.ownerClubId ?? undefined,
            sourceRunId: selectedTerritory?.sourceRunId ?? undefined
        }),
        enabled: !!activeId,
        staleTime: 60 * 1000, // 1 minute
    })

    const isClubMode = kingdomMode === 'club' && detail?.club

    // 只有在客户端且可见时才渲染 Portal
    if (typeof window === 'undefined' || !isVisible) return null;

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -100 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed top-0 left-0 right-0 z-[5000] pointer-events-auto max-w-md mx-auto"
                >
                    <div className="bg-card/90 backdrop-blur-xl shadow-2xl px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1rem)] border-b border-white/10">
                        {/* 状态指示器 */}
                        {activeId === 'legacy' && (
                            <div className="mb-2 py-1 px-3 bg-primary/20 border border-primary/30 rounded-full flex items-center justify-center gap-1.5 self-center">
                                <span className="text-[10px] font-bold text-primary">
                                    ✨ 领地已由运动轨迹精准映射生成
                                </span>
                            </div>
                        )}
                        
                        <div 
                            className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all bg-white/5 hover:bg-white/10 p-2.5 rounded-2xl border border-white/5"
                            onClick={() => setIsDetailSheetOpen?.(true)}
                        >
                            <div className="flex-1 min-w-0">
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        <span className="text-sm font-medium text-muted-foreground animate-pulse">正在解析领主时空...</span>
                                    </div>
                                ) : (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="font-bold text-lg text-foreground truncate tracking-tight">
                                                    {isClubMode ? detail?.club?.name : (detail?.owner?.nickname || '神秘领主')}
                                                </span>
                                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm ${isClubMode ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                                                    {isClubMode ? 'CLUB' : 'LEGEND'}
                                                </div>
                                            </div>
                                            {detail && (
                                                <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-muted-foreground/80">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-1 h-1 rounded-full bg-primary/40"></span>
                                                        面积: {detail.area} km²
                                                    </span>
                                                    {detail.current_hp !== undefined && (
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-1 h-1 rounded-full bg-red-400/40"></span>
                                                            能量: {detail.current_hp}/1000
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-primary/20 blur-md rounded-full group-hover:bg-primary/40 transition-all"></div>
                                        {!isLoading && (detail?.club || detail?.owner) && (
                                            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 shadow-xl flex items-center justify-center bg-secondary">
                                                {isClubMode && detail?.club?.logoUrl ? (
                                                    <img src={detail.club.logoUrl} alt="club" className="w-full h-full object-cover" />
                                                ) : detail?.owner?.avatarUrl ? (
                                                    <img src={detail.owner.avatarUrl} alt="owner" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm font-bold text-white/40">
                                                        {isClubMode ? detail?.club?.name.substring(0, 1) : detail?.owner?.nickname.substring(0,1)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2">
                                        <span className="text-[10px] text-muted-foreground font-medium">点击查看详情</span>
                                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 text-muted-foreground">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    )
}

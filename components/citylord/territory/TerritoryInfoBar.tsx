'use client'

import { useMapInteraction } from '@/components/map/MapInteractionContext'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { getTerritoryDetail } from '@/app/actions/territory-detail'
import { Loader2, ChevronRight } from 'lucide-react'

export function TerritoryInfoBar() {
    const { selectedTerritory, viewMode, kingdomMode, setIsDetailSheetOpen } = useMapInteraction()

    const isVisible = selectedTerritory !== null && viewMode === 'individual'
    
    const { data: detail, isLoading } = useQuery({
        queryKey: ['territory-detail', selectedTerritory?.id],
        queryFn: () => getTerritoryDetail(selectedTerritory!.id),
        enabled: !!selectedTerritory?.id,
        staleTime: 60 * 1000, // 1 minute
    })

    const isClubMode = kingdomMode === 'club' && detail?.club

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.2 }}
                    className="fixed top-0 left-0 right-0 z-[5000] pointer-events-auto"
                >
                    <div className="bg-card/95 backdrop-blur-md shadow-lg p-3 pb-4 pt-10 flex flex-col gap-2 relative border-b border-border">
                        {/* 覆盖整个导航条区域 (包括沉浸式额头) */}
                        {/* 历史映射标识 */}
                        {!detail && selectedTerritory && (
                            <div className="mb-1 -mt-1 py-1 w-full bg-orange-500/20 rounded text-center">
                                <span className="text-[10px] font-bold text-orange-500">
                                    📍 历史轨迹测算，未生成规范六边形领地
                                </span>
                            </div>
                        )}
                        
                        <div 
                            className="flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                            onClick={() => setIsDetailSheetOpen?.(true)}
                        >
                            <div className="flex-1 min-w-0">
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        <span className="text-sm font-medium text-muted-foreground">加载领主信息...</span>
                                    </div>
                                ) : (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="font-bold text-base text-foreground truncate">
                                                    {isClubMode ? detail?.club?.name : (detail?.owner?.nickname || '领主')}
                                                </span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded-sm whitespace-nowrap ${isClubMode ? 'bg-orange-500/20 text-orange-400' : 'bg-primary/20 text-primary'}`}>
                                                    {isClubMode ? '俱乐部领地' : '领地领主'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                面积: {detail?.area || 0} km²
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Optional right side icon or stat */}
                                <div className="flex-shrink-0 ml-3 text-right">
                                    {!isLoading && isClubMode && detail?.club ? (
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                                            {detail.club.logoUrl ? (
                                                <img src={detail.club.logoUrl} alt="club avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold text-muted-foreground">{detail.club.name.substring(0, 1)}</span>
                                            )}
                                        </div>
                                    ) : !isLoading && detail?.owner && (
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                                            {detail.owner.avatarUrl ? (
                                                <img src={detail.owner.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs font-bold text-muted-foreground">{detail.owner.nickname.substring(0, 1)}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-shrink-0 ml-2 text-muted-foreground flex items-center">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        )
    }

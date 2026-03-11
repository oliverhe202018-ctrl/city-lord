'use client'

import { useMap } from '@/components/map/AMapContext'
import { AnimatePresence, motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { getTerritoryDetail } from '@/app/actions/territory-detail'
import { Loader2 } from 'lucide-react'

export function TerritoryInfoBar() {
    const { selectedTerritory, viewMode, kingdomMode } = useMap()

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
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2 }}
                    className="fixed left-4 right-4 z-[1050]"
                    // Positioned safely below the MapHeader (which takes roughly 5rem)
                    style={{ top: 'calc(env(safe-area-inset-top) + 4.5rem)' }}
                >
                    <div className="bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border border-border/50 shadow-lg rounded-xl p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">加载领主信息...</span>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="font-bold text-base truncate">
                                            {isClubMode ? detail?.club?.name : (detail?.owner?.nickname || '神秘领主')}
                                        </span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-sm whitespace-nowrap ${isClubMode ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
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
                            {!isLoading && isClubMode && detail.club ? (
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
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

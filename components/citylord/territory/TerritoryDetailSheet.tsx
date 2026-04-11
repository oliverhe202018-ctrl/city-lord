'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import { useMapInteraction } from '@/components/map/MapInteractionContext'
import { useQuery } from '@tanstack/react-query'
import { getTerritoryDetail } from '@/app/actions/territory-detail'
import { Loader2, MapPin, Clock, Medal, Flag, Timer, User } from 'lucide-react'
import { TerritoryMoreMenu } from './TerritoryMoreMenu'
import dayjs from 'dayjs'
import Link from 'next/link'
import { TerritoryReportDialog } from './TerritoryReportDialog'
import { useGameStore } from '@/store/useGameStore'

export function TerritoryDetailSheet() {
    const { selectedTerritory, kingdomMode, isDetailSheetOpen, setIsDetailSheetOpen } = useMapInteraction()
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const selectedTerritoryId = useGameStore((state) => state.selectedTerritoryId)

    // Use store ID as primary, fallback to context
    const activeId = selectedTerritoryId || selectedTerritory?.id || null

    // Sheet is open when explicitly opened + we have a territory
    const isOpen = Boolean(isDetailSheetOpen && activeId !== null)
    const territoryId = activeId
    const isClubMode = kingdomMode === 'club'


    const { data: detail, isLoading } = useQuery({
        queryKey: ['territory-detail', activeId],
        queryFn: () => getTerritoryDetail(territoryId!, {
            ownerId: selectedTerritory?.ownerId || undefined,
            clubId: selectedTerritory?.ownerClubId || undefined,
            sourceRunId: selectedTerritory?.sourceRunId
        }),
        enabled: !!territoryId,
        staleTime: 60 * 1000,
        retry: 3,
        retryDelay: 2000,
    })

    // Close sheet logic (do NOT clear selected territory, so InfoBar stays)
    const handleOpenChange = (open: boolean) => {
        setIsDetailSheetOpen?.(open)
    }

    return (
        <>
            <Drawer modal={false} open={isOpen} onOpenChange={handleOpenChange} dismissible={true}>
                <DrawerOverlay onClick={() => setIsDetailSheetOpen?.(false)} className="bg-transparent z-[1050] pointer-events-none" />
                <DrawerContent onPointerDownOutside={() => setIsDetailSheetOpen?.(false)} className="bg-card/95 backdrop-blur-md border-t border-border outline-none max-w-md mx-auto pointer-events-auto z-[1050]">
                    {/* Prevent drawer from filling whole screen, allow interaction with map above */}
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-2" />

                    <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto overflow-x-hidden">
                        {isLoading || detail?.status === 'pending' ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {detail?.status === 'pending' ? '领地数据云端结算中...' : '加载领地详细信息...'}
                                </span>
                            </div>
                        ) : (!detail && !selectedTerritory) ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                未能获取领地信息
                            </div>
                        ) : (
                            // Render with real detail or fallback to synthetic selectedTerritory data
                            (() => {
                                const fallbackId = selectedTerritory?.id || '未知';
                                const fallbackArea = 0; 
                                
                                const displayDetail = detail || {
                                    territoryId: fallbackId,
                                    cityName: '由历史轨迹映射',
                                    capturedAt: selectedTerritory?.capturedAt || null,
                                    area: fallbackArea,
                                    owner: {
                                        id: selectedTerritory?.ownerId || '',
                                        nickname: '领主',
                                        avatarUrl: null
                                    },
                                    club: null,
                                    recentRun: null,
                                    current_hp: 1000,
                                    score_weight: 1.0,
                                    territory_type: 'NORMAL'
                                };
                                return (
                                    <>
                                        {/* 历史映射标识 */}
                                        {activeId === 'legacy' && (
                                            <div className="mb-3 py-1 w-full bg-primary/20 rounded text-center border border-primary/30">
                                                <span className="text-[10px] font-bold text-primary">
                                                    ✨ 领地已由运动轨迹精准映射生成
                                                </span>
                                            </div>
                                        )}

                                        {/* Header Row: Avatar, Nickname, Menu */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                                            {isClubMode && displayDetail.club ? (
                                                displayDetail.club.logoUrl ? (
                                                    <img src={displayDetail.club.logoUrl} alt="club avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-lg font-bold text-muted-foreground">
                                                        {displayDetail.club.name.substring(0, 1)}
                                                    </span>
                                                )
                                            ) : (
                                                displayDetail.owner?.avatarUrl ? (
                                                    <img src={displayDetail.owner.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-lg font-bold text-muted-foreground">
                                                        {displayDetail.owner ? displayDetail.owner.nickname.substring(0, 1) : '?'}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg text-foreground">
                                                {isClubMode && displayDetail.club ? displayDetail.club.name : (displayDetail.owner?.nickname || '领主')}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {displayDetail.cityName} · 领地 ID: {displayDetail.territoryId.substring(0, 6)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Menu (Report) - Only show for real territories */}
                                    {detail && (
                                        <div className="flex-shrink-0">
                                            <TerritoryMoreMenu
                                                territoryId={displayDetail.territoryId}
                                                ownerId={displayDetail.owner?.id || null}
                                                onReportClick={() => setReportDialogOpen(true)}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Main Stats Grid */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50 border border-border/50">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            占领时间
                                        </span>
                                        <span className="text-sm font-medium text-foreground">
                                            {displayDetail.capturedAt ? dayjs(displayDetail.capturedAt).format('YYYY-MM-DD HH:mm') : '--'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50 border border-border/50">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            {isClubMode ? <User className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" />}
                                            {isClubMode ? '占领者个人' : '所属俱乐部'}
                                        </span>
                                        <span className="text-sm font-medium text-foreground truncate">
                                            {isClubMode ? (displayDetail.owner?.nickname || '--') : (displayDetail.club?.name || '--')}
                                        </span>
                                    </div>
                                </div>

                                {/* New Stats Grid (HP, Weight, Type) */}
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-green-500/10 border border-green-500/20 items-center">
                                        <span className="text-[10px] text-muted-foreground">当前血量</span>
                                        <span className="text-sm font-bold text-green-500">{displayDetail.current_hp ?? 1000}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 items-center">
                                        <span className="text-[10px] text-muted-foreground">积分比重</span>
                                        <span className="text-sm font-bold text-blue-500">x{displayDetail.score_weight ?? '1.0'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 items-center">
                                        <span className="text-[10px] text-muted-foreground">领地类型</span>
                                        <span className="text-sm font-bold text-orange-500">{displayDetail.territory_type ?? 'NORMAL'}</span>
                                    </div>
                                </div>

                                {/* Sub Stats Grid (Recent Run & Area) */}
                                <div className="pt-2 border-t mt-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                                        <Flag className="w-3.5 h-3.5" />
                                        攻占地块跑步记录
                                    </h4>
                                    {displayDetail.recentRun?.id ? (
                                        <Link href={`/run/detail?id=${displayDetail.recentRun.id}`} className="block hover:bg-white/5 rounded-lg transition-colors">
                                            <div className="grid grid-cols-4 gap-2">
                                                <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                    <span className="text-[10px] text-muted-foreground mb-1">距离 (km)</span>
                                                    <span className="text-sm font-bold text-foreground">{displayDetail.recentRun?.distanceKm ?? '--'}</span>
                                                </div>
                                                <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                    <span className="text-[10px] text-muted-foreground mb-1">时长</span>
                                                    <span className="text-sm font-bold text-foreground">{displayDetail.recentRun?.durationStr || '--'}</span>
                                                </div>
                                                <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                    <span className="text-[10px] text-muted-foreground mb-1">配速</span>
                                                    <span className="text-sm font-bold text-foreground">{displayDetail.recentRun?.paceMinPerKm || '--'}</span>
                                                </div>
                                                <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                    <span className="text-[10px] text-muted-foreground mb-1">领地面积</span>
                                                    <span className="text-sm font-bold text-foreground">{displayDetail.area}</span>
                                                    <span className="text-[10px] text-muted-foreground -mt-1">km²</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                <span className="text-[10px] text-muted-foreground mb-1">距离 (km)</span>
                                                <span className="text-sm font-bold text-foreground">{displayDetail.recentRun?.distanceKm ?? '--'}</span>
                                            </div>
                                            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                <span className="text-[10px] text-muted-foreground mb-1">时长</span>
                                                <span className="text-sm font-bold text-foreground">{displayDetail.recentRun?.durationStr || '--'}</span>
                                            </div>
                                            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                <span className="text-[10px] text-muted-foreground mb-1">配速</span>
                                                <span className="text-sm font-bold text-foreground">{displayDetail.recentRun?.paceMinPerKm || '--'}</span>
                                            </div>
                                            <div className="flex flex-col items-center text-center p-2 rounded-lg bg-muted/50 border border-border/50">
                                                <span className="text-[10px] text-muted-foreground mb-1">领地面积</span>
                                                <span className="text-sm font-bold text-foreground">{displayDetail.area}</span>
                                                <span className="text-[10px] text-muted-foreground -mt-1">km²</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                            })()
                        )}
                    </div>
                </DrawerContent>
            </Drawer>

            {/* Report Dialog */}
            {detail && (
                <TerritoryReportDialog
                    open={reportDialogOpen}
                    onOpenChange={setReportDialogOpen}
                    detail={detail}
                />
            )}
        </>
    )
}

'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import { useMap } from '@/components/map/AMapContext'
import { useQuery } from '@tanstack/react-query'
import { getTerritoryDetail } from '@/app/actions/territory-detail'
import { Loader2, MapPin, Clock, Medal, Flag, Timer } from 'lucide-react'
import { TerritoryMoreMenu } from './TerritoryMoreMenu'
import dayjs from 'dayjs'
import { TerritoryReportDialog } from './TerritoryReportDialog'

export function TerritoryDetailSheet() {
    const { selectedTerritory, viewMode, setSelectedTerritory } = useMap()
    const [reportDialogOpen, setReportDialogOpen] = useState(false)

    // Sheet is open when there's a selected territory in individual view
    const isOpen = selectedTerritory !== null && viewMode === 'individual'
    const territoryId = selectedTerritory?.id

    const { data: detail, isLoading } = useQuery({
        queryKey: ['territory-detail', territoryId],
        queryFn: () => getTerritoryDetail(territoryId!),
        enabled: !!territoryId,
        staleTime: 60 * 1000,
    })

    // Close sheet by clearing selection
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setSelectedTerritory?.(null)
        }
    }

    return (
        <>
            <Drawer open={isOpen} onOpenChange={handleOpenChange} dismissible={true}>
                <DrawerOverlay className="bg-transparent" />
                <DrawerContent className="bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 outline-none max-w-md mx-auto pointer-events-auto">
                    {/* Prevent drawer from filling whole screen, allow interaction with map above */}
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-2" />

                    <div className="p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto overflow-x-hidden">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">加载领地详细信息...</span>
                            </div>
                        ) : !detail ? (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                未能获取领地信息
                            </div>
                        ) : (
                            <>
                                {/* Header Row: Avatar, Nickname, Menu */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
                                            {detail.owner?.avatarUrl ? (
                                                <img src={detail.owner.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-lg font-bold">
                                                    {detail.owner ? detail.owner.nickname.substring(0, 1) : '?'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg">
                                                {detail.owner?.nickname || '神秘领主'}
                                            </span>
                                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {detail.cityName} · 领地 ID: {detail.territoryId.substring(0, 6)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Menu (Report) */}
                                    <div className="flex-shrink-0">
                                        <TerritoryMoreMenu
                                            territoryId={detail.territoryId}
                                            ownerId={detail.owner?.id || null}
                                            onReportClick={() => setReportDialogOpen(true)}
                                        />
                                    </div>
                                </div>

                                {/* Main Stats Grid */}
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            占领时间
                                        </span>
                                        <span className="text-sm font-medium">
                                            {detail.capturedAt ? dayjs(detail.capturedAt).format('YYYY-MM-DD HH:mm') : '--'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/50">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Medal className="w-3.5 h-3.5" />
                                            所属俱乐部
                                        </span>
                                        <span className="text-sm font-medium truncate">
                                            {detail.club?.name || '--'}
                                        </span>
                                    </div>
                                </div>

                                {/* Sub Stats Grid (Recent Run & Area) */}
                                <div className="pt-2 border-t mt-2">
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                                        <Flag className="w-3.5 h-3.5" />
                                        领主最近跑步
                                    </h4>
                                    <div className="grid grid-cols-4 gap-2">
                                        <div className="flex flex-col items-center text-center p-2 rounded-lg bg-primary/5">
                                            <span className="text-[10px] text-muted-foreground mb-1">距离 (km)</span>
                                            <span className="text-sm font-bold">{detail.recentRun?.distanceKm ?? '--'}</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-2 rounded-lg bg-primary/5">
                                            <span className="text-[10px] text-muted-foreground mb-1">时长</span>
                                            <span className="text-sm font-bold">{detail.recentRun?.durationStr || '--'}</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-2 rounded-lg bg-primary/5">
                                            <span className="text-[10px] text-muted-foreground mb-1">配速</span>
                                            <span className="text-sm font-bold">{detail.recentRun?.paceMinPerKm || '--'}</span>
                                        </div>
                                        <div className="flex flex-col items-center text-center p-2 rounded-lg bg-primary/5">
                                            <span className="text-[10px] text-muted-foreground mb-1">领地面积</span>
                                            <span className="text-sm font-bold">{detail.area}</span>
                                            <span className="text-[10px] text-muted-foreground -mt-1">km²</span>
                                        </div>
                                    </div>
                                </div>
                            </>
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

'use client'

import { useState } from 'react'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import { useMapInteraction } from '@/components/map/MapInteractionContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getTerritoryDetail } from '@/app/actions/territory-detail'
import { Loader2, MapPin, Clock, Medal, Flag, Timer, User, Pencil, RotateCcw } from 'lucide-react'
import { TerritoryMoreMenu } from './TerritoryMoreMenu'
import dayjs from 'dayjs'
import Link from 'next/link'
import { TerritoryReportDialog } from './TerritoryReportDialog'
import { useGameStore } from '@/store/useGameStore'
import { renameTerritory } from '@/app/actions/territory-rename'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { getTerritoryDisplayName } from '@/lib/territory-display'

const RENAME_MAX_LENGTH = 10

export function TerritoryDetailSheet() {
    const { selectedTerritory, kingdomMode, isDetailSheetOpen, setIsDetailSheetOpen } = useMapInteraction()
    const [reportDialogOpen, setReportDialogOpen] = useState(false)
    const [renameDialogOpen, setRenameDialogOpen] = useState(false)
    const [renameInput, setRenameInput] = useState('')
    const [isRenaming, setIsRenaming] = useState(false)
    const selectedTerritoryId = useGameStore((state) => state.selectedTerritoryId)
    const { user } = useAuth()
    const queryClient = useQueryClient()

    const activeId = selectedTerritoryId || selectedTerritory?.id || null

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

    const isOwner = user?.id === detail?.owner?.id

    const handleOpenChange = (open: boolean) => {
        setIsDetailSheetOpen?.(open)
    }

    const handleRenameSubmit = async (isReset = false) => {
        const submitValue = isReset ? '' : renameInput
        if (!territoryId) return

        setIsRenaming(true)
        try {
            const result = await renameTerritory(territoryId, submitValue)

            if (!result.success) {
                if (result.code === 'COOLDOWN') {
                    toast.error(`改名冷却期还剩 ${result.remainingDays} 天`)
                } else if (result.code === 'SENSITIVE_WORD') {
                    toast.error('名称包含敏感词汇，请修改后重试')
                } else if (result.code === 'INVALID_LENGTH') {
                    toast.error(`名称长度不能超过 ${RENAME_MAX_LENGTH} 个字符`)
                } else {
                    toast.error(result.error || '改名失败')
                }
                return
            }

            toast.success(isReset ? '已恢复默认名称' : '领地名称已更新')
            setRenameDialogOpen(false)
            setRenameInput('')
            await queryClient.invalidateQueries({ queryKey: ['territory-detail', activeId] })
        } catch (error) {
            toast.error('服务器错误，请稍后重试')
        } finally {
            setIsRenaming(false)
        }
    }

    const handleOpenRenameDialog = () => {
        setRenameInput(detail?.customName || '')
        setRenameDialogOpen(true)
    }

    return (
        <>
            <Drawer modal={false} open={isOpen} onOpenChange={handleOpenChange} dismissible={true}>
                <DrawerOverlay onClick={() => setIsDetailSheetOpen?.(false)} className="bg-transparent z-[1050] pointer-events-none" />
                <DrawerContent onPointerDownOutside={() => setIsDetailSheetOpen?.(false)} className="bg-card/95 backdrop-blur-md border-t border-border outline-none max-w-md mx-auto pointer-events-auto z-[1050]">
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
                                    health: 100,
                                    score_weight: 1.0,
                                    territory_type: 'NORMAL',
                                    lastAttackedAt: null
                                };

                                const health = displayDetail.health ?? 100;
                                const healthPercent = Math.max(0, Math.min(100, health));
                                const healthColor = healthPercent <= 40 ? 'bg-red-500' : healthPercent <= 70 ? 'bg-orange-500' : 'bg-green-500';
                                
                                const displayName = getTerritoryDisplayName({
                                    id: displayDetail.territoryId,
                                    customName: detail?.customName,
                                    clubName: displayDetail.club?.name,
                                    ownerNickname: displayDetail.owner?.nickname
                                })
                                
                                return (
                                    <>
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
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg text-foreground">
                                                            {displayName}
                                                        </span>
                                                        {isOwner && (
                                                            <button
                                                                onClick={handleOpenRenameDialog}
                                                                className="p-1 rounded-md hover:bg-muted transition-colors"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="w-3 h-3" />
                                                        {displayDetail.cityName} · 领地 ID: {displayDetail.territoryId.substring(0, 6)}
                                                    </span>
                                                </div>
                                            </div>

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

                                        <div className="grid grid-cols-3 gap-2 mt-2">
                                            <div className="col-span-3 mt-4 space-y-1.5">
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span className="text-muted-foreground">领地完整度</span>
                                                    <span className={healthPercent <= 40 ? 'text-red-500 font-bold' : ''}>
                                                        {healthPercent} / 100
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${healthColor} transition-all duration-500 ease-out`} 
                                                        style={{ width: `${healthPercent}%` }} 
                                                    />
                                                </div>
                                                {displayDetail.lastAttackedAt && (
                                                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                                        <span>⚔️</span>
                                                        <span>上次遇袭: {new Date(displayDetail.lastAttackedAt).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 items-center">
                                                <span className="text-[10px] text-muted-foreground">积分比重</span>
                                                <span className="text-sm font-bold text-blue-500">x{displayDetail.score_weight ?? '1.0'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 items-center">
                                                <span className="text-[10px] text-muted-foreground">领地类型</span>
                                                <span className="text-sm font-bold text-orange-500">{displayDetail.territory_type ?? 'NORMAL'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1 p-2 rounded-lg bg-gray-500/10 border border-gray-500/20 items-center">
                                                <span className="text-[10px] text-muted-foreground">当前血量</span>
                                                <span className={`text-sm font-bold ${healthColor.replace('bg-', 'text-')}`}>{displayDetail.current_hp ?? 1000}</span>
                                            </div>
                                        </div>

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

            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>重命名领地</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="relative">
                            <Input
                                value={renameInput}
                                onChange={(e) => setRenameInput(e.target.value)}
                                placeholder="输入新的领地名称"
                                maxLength={RENAME_MAX_LENGTH}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isRenaming) {
                                        handleRenameSubmit()
                                    }
                                }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {renameInput.length}/{RENAME_MAX_LENGTH}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            名称长度 1-{RENAME_MAX_LENGTH} 个字符，每 7 天可修改一次
                        </p>
                    </div>
                    <DialogFooter className="flex gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={isRenaming}>
                            取消
                        </Button>
                        <Button variant="ghost" onClick={() => handleRenameSubmit(true)} disabled={isRenaming} className="flex items-center gap-1">
                            <RotateCcw className="w-3.5 h-3.5" />
                            恢复默认
                        </Button>
                        <Button onClick={() => handleRenameSubmit()} disabled={isRenaming || !renameInput.trim()}>
                            {isRenaming ? '保存中...' : '保存'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

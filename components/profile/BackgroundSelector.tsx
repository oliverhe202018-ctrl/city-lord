'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Image from 'next/image'
import { ArrowLeft, Check, Lock, Sparkles } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { getBackgrounds, updateProfileBackground } from '@/app/actions/profile'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface BackgroundItem {
    id: string
    name: string
    previewUrl: string | null
    imageUrl: string
    isDefault: boolean
    conditionType: string | null
    conditionValue: number | null
    priceCoins: number | null
    isOwned: boolean
    isLocked: boolean
    isActive: boolean
}

export function BackgroundSelector() {
    const router = useRouter()
    const [filter, setFilter] = useState<'all' | 'mine' | 'available' | 'expired'>('all')
    const [backgrounds, setBackgrounds] = useState<BackgroundItem[]>([])
    const [currentBg, setCurrentBg] = useState<BackgroundItem | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [selectedId, setSelectedId] = useState<string | null>(null)

    useEffect(() => {
        loadBackgrounds()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter])

    const loadBackgrounds = async () => {
        setLoading(true)
        try {
            const result = await getBackgrounds(filter)
            setBackgrounds(result.backgrounds)
            setCurrentBg(result.currentBg)
        } catch (e) {
            console.error('Failed to load backgrounds:', e)
            toast.error('加载背景失败')
        } finally {
            setLoading(false)
        }
    }

    const handleSelect = (bg: BackgroundItem) => {
        if (bg.isLocked) {
            toast.error(`需要 ${bg.conditionType === 'level' ? `等级 ${bg.conditionValue}` : `${bg.priceCoins} 金币`} 才能解锁`)
            return
        }
        setSelectedId(bg.id)
    }

    const handleSave = () => {
        if (!selectedId) return
        startTransition(async () => {
            const result = await updateProfileBackground(selectedId)
            if (result.success) {
                toast.success('背景已更新')
                await loadBackgrounds()
                setSelectedId(null)
            } else {
                toast.error(result.error || '更新失败')
            }
        })
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-muted/20 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <h1 className="text-lg font-bold text-foreground">选择背景</h1>
                {selectedId && (
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="ml-auto px-4 py-1.5 rounded-full bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                    >
                        {isPending ? '保存中...' : '保存'}
                    </button>
                )}
            </div>

            {/* Current equipped */}
            <div className="p-4 pb-2">
                <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">当前装备</h2>
                <div className="relative h-32 rounded-2xl overflow-hidden border border-border bg-card/50">
                    {currentBg ? (
                        <>
                            <Image src={currentBg.imageUrl} alt={currentBg.name} fill className="object-cover" />
                            <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                                {currentBg.name}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            <Sparkles className="w-4 h-4 mr-2" />
                            未选择背景
                        </div>
                    )}
                </div>
            </div>

            {/* Filter tabs */}
            <div className="px-4 py-2">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                    <TabsList className="w-full bg-muted/20">
                        <TabsTrigger value="all" className="flex-1 text-xs">全部</TabsTrigger>
                        <TabsTrigger value="mine" className="flex-1 text-xs">已拥有</TabsTrigger>
                        <TabsTrigger value="available" className="flex-1 text-xs">可获取</TabsTrigger>
                        <TabsTrigger value="expired" className="flex-1 text-xs">已过期</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-24">
                {loading ? (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-28 rounded-xl" />
                        ))}
                    </div>
                ) : backgrounds.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground text-sm">
                        暂无背景
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        {backgrounds.map(bg => (
                            <button
                                key={bg.id}
                                onClick={() => handleSelect(bg)}
                                className={`relative rounded-xl overflow-hidden border-2 transition-all h-28 group ${selectedId === bg.id
                                        ? 'border-cyan-500 ring-2 ring-cyan-500/30 scale-[1.02]'
                                        : bg.isActive
                                            ? 'border-emerald-500/50'
                                            : 'border-border hover:border-border/80'
                                    }`}
                            >
                                <Image
                                    src={bg.previewUrl || bg.imageUrl}
                                    alt={bg.name}
                                    fill
                                    className="object-cover"
                                />

                                {/* Lock overlay */}
                                {bg.isLocked && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <Lock className="w-6 h-6 text-white/70" />
                                    </div>
                                )}

                                {/* Active badge */}
                                {bg.isActive && (
                                    <div className="absolute top-1.5 right-1.5 bg-emerald-500 rounded-full p-0.5">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}

                                {/* Selected badge */}
                                {selectedId === bg.id && !bg.isActive && (
                                    <div className="absolute top-1.5 right-1.5 bg-cyan-500 rounded-full p-0.5">
                                        <Check className="w-3 h-3 text-white" />
                                    </div>
                                )}

                                {/* Name */}
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                                    <p className="text-[10px] text-white truncate">{bg.name}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

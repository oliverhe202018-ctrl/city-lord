"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { handleAppError } from "@/lib/utils/app-error"
import { getStoreItems } from "@/app/actions/redemption"
import { buyStoreItem } from "@/app/actions/store"
import { Loader2, ShoppingBag, Coins, HelpCircle, X, ShoppingCart } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { useGameStore } from "@/store/useGameStore"
import { StoreItemCard } from "./StoreItemCard"

export function StorePage() {
    const [items, setItems] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [redeemingId, setRedeemingId] = useState<string | null>(null)
    const [showRules, setShowRules] = useState(false)

    // From global store for optimistic validation (though backend is SSOT)
    const userCoins = useGameStore(state => state.coins)

    useEffect(() => {
        loadItems()
    }, [])

    const loadItems = async () => {
        try {
            const res = await getStoreItems()
            if (res.error) throw new Error(res.error)
            setItems(res.items || [])
        } catch (e: any) {
            handleAppError(e, "加载商店失败")
        } finally {
            setIsLoading(false)
        }
    }

    const handleRedeem = async (item: any) => {
        if (redeemingId) return

        if (userCoins < item.price) {
            handleAppError("积分不足")
            return
        }

        setRedeemingId(item.id)
        const idempotencyKey = uuidv4()

        try {
            const res = await buyStoreItem(item.id)
            if (!res.success) {
                throw new Error(res.error || "兑换失败")
            }
            toast.success("兑换成功！", { description: `成功兑换 ${item.name}` })

            // Deduct coins optimistic wrapper
            useGameStore.setState(state => ({ coins: Math.max(0, state.coins - item.price) }))

            // Reload items to update inventory counts
            loadItems()
        } catch (e: any) {
            handleAppError(e)
        } finally {
            setRedeemingId(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 p-4 border border-yellow-500/30">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-yellow-500 font-medium">我的积分</p>
                        <button
                            onClick={() => setShowRules(true)}
                            className="flex items-center gap-0.5 text-[10px] text-yellow-400/70 hover:text-yellow-400 transition-colors"
                        >
                            <HelpCircle className="h-3 w-3" />
                            积分规则
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Coins className="h-5 w-5 text-yellow-400" />
                        <span className="text-2xl font-bold text-foreground">{userCoins}</span>
                    </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-yellow-500" />
                </div>
            </div>

            {/* Points Rules Modal */}
            {showRules && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4 animate-in fade-in" onClick={() => setShowRules(false)}>
                    <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-background p-6 shadow-xl animate-in slide-in-from-bottom border border-border" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Coins className="h-5 w-5 text-yellow-400" />
                                积分规则
                            </h3>
                            <button onClick={() => setShowRules(false)} className="rounded-full p-2 bg-muted/50 text-muted-foreground hover:bg-muted transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 text-sm text-foreground/80">
                            <div className="rounded-xl bg-muted/30 p-3 border border-border">
                                <h4 className="font-semibold text-foreground mb-1.5">🏃 跑步获取积分</h4>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    <li>• 每日首次跑步完成：+50 积分</li>
                                    <li>• 每跑步1公里：+10 积分</li>
                                    <li>• 连续跑步7天：+200 额外积分</li>
                                </ul>
                            </div>
                            <div className="rounded-xl bg-muted/30 p-3 border border-border">
                                <h4 className="font-semibold text-foreground mb-1.5">🎯 任务获取积分</h4>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    <li>• 完成每日任务：+20~100 积分</li>
                                    <li>• 完成周常任务：+100~500 积分</li>
                                    <li>• 解锁成就：+50~300 积分</li>
                                </ul>
                            </div>
                            <div className="rounded-xl bg-muted/30 p-3 border border-border">
                                <h4 className="font-semibold text-foreground mb-1.5">🤝 社交获取积分</h4>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                    <li>• 邀请好友注册：+100 积分</li>
                                    <li>• 发布动态：+10 积分</li>
                                    <li>• 助力好友：+5 积分</li>
                                </ul>
                            </div>
                            <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
                                * 以上规则为测试版本，具体积分规则以正式公告为准
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {items.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-2xl border border-border">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                    <p>商店暂无商品</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-4 mt-6">
                    {items.map(item => (
                        <StoreItemCard 
                            key={item.id}
                            item={item}
                            userPoints={userCoins}
                            isRedeeming={redeemingId === item.id}
                            onRedeem={handleRedeem}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

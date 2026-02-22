"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { handleAppError } from "@/lib/utils/app-error"
import { getStoreItems, redeemItem } from "@/app/actions/redemption"
import { Loader2, ShoppingBag, Coins, Gift, AlertCircle, ShoppingCart } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { useGameStore } from "@/store/useGameStore"

export function StorePage() {
    const [items, setItems] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [redeemingId, setRedeemingId] = useState<string | null>(null)

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
            const res = await redeemItem({ itemId: item.id, idempotencyKey })
            if (!res.success) {
                throw new Error(res.error?.message || "兑换失败")
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
                    <p className="text-sm text-yellow-500 font-medium">我的积分</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        <Coins className="h-5 w-5 text-yellow-400" />
                        <span className="text-2xl font-bold text-foreground">{userCoins}</span>
                    </div>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-yellow-500" />
                </div>
            </div>

            {items.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-2xl border border-border">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                    <p>商店暂无商品</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {items.map(item => {
                        const isOutOfStock = item.inventory_count === 0
                        const canAfford = userCoins >= item.price
                        const isRedeeming = redeemingId === item.id

                        return (
                            <div key={item.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm flex flex-col transition-transform active:scale-95">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                        <Gift className="h-5 w-5 text-primary" />
                                    </div>
                                    {item.inventory_count > 0 && item.inventory_count <= 10 && (
                                        <span className="text-[10px] font-medium text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <AlertCircle className="h-2 w-2" />
                                            仅剩 {item.inventory_count}
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-bold text-sm text-foreground mb-1 line-clamp-1">{item.name}</h3>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 mb-3 flex-1">{item.description}</p>

                                <button
                                    onClick={() => handleRedeem(item)}
                                    disabled={isOutOfStock || !canAfford || !!redeemingId}
                                    className={`w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all ${isOutOfStock
                                        ? "bg-muted text-muted-foreground opacity-50"
                                        : !canAfford
                                            ? "bg-muted text-muted-foreground/70"
                                            : "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                                        }`}
                                >
                                    {isRedeeming ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : isOutOfStock ? (
                                        "已售罄"
                                    ) : (
                                        <>
                                            <Coins className="h-3 w-3" />
                                            {item.price}
                                        </>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

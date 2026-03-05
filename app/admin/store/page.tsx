'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { getAllStoreItems, deleteStoreItem } from '@/app/actions/admin/store-items'
import { StoreItemDialog } from '@/components/admin/StoreItemDialog'
import { Loader2, Plus, Pencil, Trash2, ShoppingBag, Package } from 'lucide-react'

export default function AdminStorePage() {
    const [items, setItems] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editItem, setEditItem] = useState<any | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const loadItems = async () => {
        setIsLoading(true)
        try {
            const res = await getAllStoreItems()
            if (!res.success) throw new Error(res.error)
            setItems(res.items || [])
        } catch (e: any) {
            toast.error(e.message || '加载失败')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        loadItems()
    }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除此兑换物？如有已购买记录将改为下架处理。')) return
        setDeletingId(id)
        try {
            const res = await deleteStoreItem(id)
            if (!res.success) throw new Error(res.error)
            if (res.softDeleted) {
                toast.info(`已下架（有 ${res.purchaseCount} 条购买记录）`)
            } else {
                toast.success('删除成功')
            }
            loadItems()
        } catch (e: any) {
            toast.error(e.message || '删除失败')
        } finally {
            setDeletingId(null)
        }
    }

    const handleEdit = (item: any) => {
        setEditItem(item)
        setDialogOpen(true)
    }

    const handleAdd = () => {
        setEditItem(null)
        setDialogOpen(true)
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ShoppingBag className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">积分商城管理</h1>
                        <p className="text-sm text-muted-foreground">管理兑换物的图片、名称、积分和库存</p>
                    </div>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                    <Plus className="h-4 w-4" />
                    新增兑换物
                </button>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted-foreground bg-muted/30 rounded-2xl border border-dashed border-border">
                    <Package className="h-10 w-10 mb-3 opacity-40" />
                    <p className="font-medium">暂无兑换物</p>
                    <p className="text-sm mt-1">点击上方按钮添加第一个兑换物</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">图片</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">名称</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">积分</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">库存</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">限购</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">已兑换</th>
                                <th className="text-left px-4 py-3 font-medium text-muted-foreground">状态</th>
                                <th className="text-right px-4 py-3 font-medium text-muted-foreground">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-3">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover border border-border" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center border border-border">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{item.name}</div>
                                        {item.description && (
                                            <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-yellow-500">{item.price}</td>
                                    <td className="px-4 py-3">
                                        {item.inventory_count === -1 ? (
                                            <span className="text-xs text-primary">无限</span>
                                        ) : (
                                            <span className={item.inventory_count <= 5 ? 'text-red-400 font-bold' : ''}>{item.inventory_count}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{item.purchase_limit_per_user}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{item._count?.purchases || 0}</td>
                                    <td className="px-4 py-3">
                                        {item.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-500">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                上架
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                                下架
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleEdit(item)}
                                                className="rounded-lg p-1.5 hover:bg-muted transition-colors"
                                                title="编辑"
                                            >
                                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                disabled={deletingId === item.id}
                                                className="rounded-lg p-1.5 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                title="删除"
                                            >
                                                {deletingId === item.id ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" />
                                                ) : (
                                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                                )}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Dialog */}
            <StoreItemDialog
                open={dialogOpen}
                onClose={() => { setDialogOpen(false); setEditItem(null) }}
                onSaved={loadItems}
                editItem={editItem}
            />
        </div>
    )
}

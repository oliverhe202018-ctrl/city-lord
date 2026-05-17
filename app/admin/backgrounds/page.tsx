'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    getAllBackgrounds,
    deleteBackground,
    checkBackgroundUsage,
    type BackgroundRecord,
} from '@/app/actions/admin/backgrounds'
import { BackgroundDialog } from '@/components/admin/BackgroundDialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Eye, Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function AdminBackgroundsPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [authChecked, setAuthChecked] = useState(false)
    const [backgrounds, setBackgrounds] = useState<BackgroundRecord[]>([])
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingBackground, setEditingBackground] = useState<BackgroundRecord | null>(null)
    const [viewImageUrl, setViewImageUrl] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    // ─── Load Backgrounds ──────────────────────────────────────
    useEffect(() => {
        loadBackgrounds()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const loadBackgrounds = async () => {
        setLoading(true)
        try {
            const data = await getAllBackgrounds()
            setBackgrounds(data)
            setAuthChecked(true)
        } catch (e: any) {
            if (e.message?.includes('Unauthorized')) {
                toast.error('已过期或无权限，请重新登录')
                router.replace('/admin/login')
            } else {
                toast.error(e.message || '加载失败')
                setAuthChecked(true) // Set to true to allow user strictly view the error state instead of infinite loading
            }
        } finally {
            setLoading(false)
        }
    }

    // ─── Handlers ──────────────────────────────────────────────
    const handleAdd = () => {
        setEditingBackground(null)
        setDialogOpen(true)
    }

    const handleEdit = (bg: BackgroundRecord) => {
        setEditingBackground(bg)
        setDialogOpen(true)
    }

    const handleDelete = async (bg: BackgroundRecord) => {
        if (!confirm(`确定删除背景 "${bg.name}"？`)) return

        setDeletingId(bg.id)
        try {
            // Check usage first (defensive)
            const usage = await checkBackgroundUsage(bg.id)
            if (usage.inUse) {
                toast.error(`该背景正被 ${usage.usageCount} 位用户使用，无法删除`)
                return
            }

            const result = await deleteBackground(bg.id)
            if (result.success) {
                toast.success(result.message || '删除成功')
                loadBackgrounds()
            } else {
                toast.error(result.error || '删除失败')
            }
        } catch (e: any) {
            toast.error(e.message || '操作失败')
        } finally {
            setDeletingId(null)
        }
    }

    const handleViewImage = (url: string) => {
        setViewImageUrl(url)
    }

    // ─── Render Auth/Loading ───────────────────────────────────
    if (!authChecked || loading) {
        return (
            <div className="p-8 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
            </div>
        )
    }

    // ─── Main Render ───────────────────────────────────────────
    return (
        <div className="p-8 space-y-6 bg-background text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">背景管理</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        管理用户可选择的背景图片
                    </p>
                </div>
                <Button onClick={handleAdd} className="bg-cyan-500 hover:bg-cyan-600">
                    <Plus className="w-4 h-4 mr-2" />
                    新增背景
                </Button>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/20">
                            <TableHead className="w-24">预览</TableHead>
                            <TableHead>名称</TableHead>
                            <TableHead>类型</TableHead>
                            <TableHead>价格/条件</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {backgrounds.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    暂无背景，点击「新增背景」开始添加
                                </TableCell>
                            </TableRow>
                        ) : (
                            backgrounds.map((bg) => (
                                <TableRow key={bg.id}>
                                    {/* Thumbnail */}
                                    <TableCell>
                                        <button
                                            onClick={() => handleViewImage(bg.imageUrl)}
                                            className="relative w-16 h-12 rounded overflow-hidden border border-border hover:ring-2 ring-cyan-500 transition-all"
                                        >
                                            <Image
                                                src={bg.previewUrl || bg.imageUrl}
                                                alt={bg.name}
                                                fill
                                                className="object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                                                <Eye className="w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    </TableCell>

                                    {/* Name */}
                                    <TableCell className="font-medium">{bg.name}</TableCell>

                                    {/* Type */}
                                    <TableCell>
                                        {bg.isDefault && (
                                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs border border-emerald-500/20">
                                                免费/默认
                                            </span>
                                        )}
                                        {bg.conditionType === 'level' && (
                                            <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs border border-purple-500/20">
                                                等级解锁
                                            </span>
                                        )}
                                        {bg.conditionType === 'coins' && (
                                            <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs border border-amber-500/20">
                                                💰 金币商品
                                            </span>
                                        )}
                                    </TableCell>

                                    {/* Price/Condition */}
                                    <TableCell className="text-sm text-muted-foreground">
                                        {bg.isDefault && '—'}
                                        {bg.conditionType === 'level' && `等级 ≥ ${bg.conditionValue}`}
                                        {bg.conditionType === 'coins' && `${bg.priceCoins} 金币`}
                                    </TableCell>

                                    {/* Status */}
                                    <TableCell>
                                        {bg.usageCount > 0 ? (
                                            <span className="text-xs text-cyan-400">
                                                {bg.usageCount} 人使用中
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">未使用</span>
                                        )}
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleEdit(bg)}
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDelete(bg)}
                                                disabled={bg.usageCount > 0 || deletingId === bg.id}
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                                            >
                                                {deletingId === bg.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Form Dialog */}
            <BackgroundDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                editingBackground={editingBackground}
                onSuccess={loadBackgrounds}
            />

            {/* Image Viewer */}
            <Dialog open={!!viewImageUrl} onOpenChange={() => setViewImageUrl(null)}>
                <DialogContent className="max-w-4xl bg-black/90 border-border">
                    {viewImageUrl && (
                        <div className="relative w-full h-[80vh]">
                            <Image
                                src={viewImageUrl}
                                alt="Full size"
                                fill
                                className="object-contain"
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

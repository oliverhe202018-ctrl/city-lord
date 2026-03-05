'use client'

import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { upsertStoreItem, uploadStoreItemImage, type StoreItemInput } from '@/app/actions/admin/store-items'
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react'

interface StoreItemDialogProps {
    open: boolean
    onClose: () => void
    onSaved: () => void
    editItem?: any | null
}

export function StoreItemDialog({ open, onClose, onSaved, editItem }: StoreItemDialogProps) {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [price, setPrice] = useState(100)
    const [inventoryCount, setInventoryCount] = useState(-1)
    const [purchaseLimit, setPurchaseLimit] = useState(1)
    const [isActive, setIsActive] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (editItem) {
            setName(editItem.name || '')
            setDescription(editItem.description || '')
            setImageUrl(editItem.image_url || '')
            setPrice(editItem.price || 100)
            setInventoryCount(editItem.inventory_count ?? -1)
            setPurchaseLimit(editItem.purchase_limit_per_user ?? 1)
            setIsActive(editItem.is_active ?? true)
        } else {
            setName('')
            setDescription('')
            setImageUrl('')
            setPrice(100)
            setInventoryCount(-1)
            setPurchaseLimit(1)
            setIsActive(true)
        }
    }, [editItem, open])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await uploadStoreItemImage(formData)
            if (!res.success) throw new Error(res.error)
            setImageUrl(res.url!)
            toast.success('图片上传成功')
        } catch (err: any) {
            toast.error(err.message || '上传失败')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('请填写商品名称')
            return
        }
        if (price < 0) {
            toast.error('积分不能为负数')
            return
        }

        setIsSaving(true)
        try {
            const input: StoreItemInput = {
                id: editItem?.id,
                name: name.trim(),
                description: description.trim() || undefined,
                image_url: imageUrl || undefined,
                price,
                inventory_count: inventoryCount,
                purchase_limit_per_user: purchaseLimit,
                is_active: isActive,
            }
            const res = await upsertStoreItem(input)
            if (!res.success) throw new Error(res.error)
            toast.success(editItem ? '更新成功' : '创建成功')
            onSaved()
            onClose()
        } catch (err: any) {
            toast.error(err.message || '保存失败')
        } finally {
            setIsSaving(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
            <div
                className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl border border-border max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold">{editItem ? '编辑兑换物' : '新增兑换物'}</h2>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-muted transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Image Upload */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">商品图片</label>
                        <div className="flex items-center gap-3">
                            {imageUrl ? (
                                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border">
                                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => setImageUrl('')}
                                        className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5"
                                    >
                                        <X className="h-3 w-3 text-white" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                </div>
                            )}
                            <div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageUpload}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
                                >
                                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                    {isUploading ? '上传中...' : '上传图片'}
                                </button>
                                <p className="text-[10px] text-muted-foreground mt-1">支持 JPG/PNG/WebP，最大 2MB</p>
                            </div>
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">商品名称 *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="例：专属头像框"
                            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            maxLength={50}
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">描述</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="商品描述..."
                            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                            rows={2}
                            maxLength={200}
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="text-sm font-medium mb-1.5 block">所需积分 *</label>
                        <input
                            type="number"
                            value={price}
                            onChange={e => setPrice(parseInt(e.target.value) || 0)}
                            min={0}
                            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    {/* Inventory */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">库存数量</label>
                            <input
                                type="number"
                                value={inventoryCount}
                                onChange={e => setInventoryCount(parseInt(e.target.value) || -1)}
                                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5">-1 = 无限</p>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">每人限购</label>
                            <input
                                type="number"
                                value={purchaseLimit}
                                onChange={e => setPurchaseLimit(parseInt(e.target.value) || 1)}
                                min={1}
                                className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between py-2 px-1">
                        <span className="text-sm font-medium">上架状态</span>
                        <button
                            onClick={() => setIsActive(!isActive)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-muted'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isActive ? 'left-5.5 translate-x-0' : 'left-0.5'}`}
                                style={{ left: isActive ? '22px' : '2px' }}
                            />
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-border hover:bg-muted transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 rounded-xl py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </div>
    )
}

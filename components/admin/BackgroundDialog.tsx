'use client'

import React, { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { uploadBackgroundImage, upsertBackground, type BackgroundFormData, type BackgroundRecord } from '@/app/actions/admin/backgrounds'
import { Loader2, Upload, X } from 'lucide-react'
import Image from 'next/image'

// ─── Zod Schema ────────────────────────────────────────────
const backgroundFormSchema = z.object({
    name: z.string().min(1, '名称不能为空').max(50, '名称最长50字'),
    imageUrl: z.string().url('请上传图片'),
    acquisitionType: z.enum(['free', 'coins', 'level'], {
        required_error: '请选择获取方式',
    }),
    priceCoins: z.number().int().min(0).optional(),
    conditionValue: z.number().int().min(1).optional(),
}).refine(
    (data) => {
        if (data.acquisitionType === 'coins' && !data.priceCoins) {
            return false
        }
        if (data.acquisitionType === 'level' && !data.conditionValue) {
            return false
        }
        return true
    },
    {
        message: '请填写对应的价格或条件',
        path: ['acquisitionType'],
    }
)

type FormValues = z.infer<typeof backgroundFormSchema>

// ─── Component ─────────────────────────────────────────────
interface BackgroundDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingBackground: BackgroundRecord | null
    onSuccess: () => void
}

export function BackgroundDialog({
    open,
    onOpenChange,
    editingBackground,
    onSuccess,
}: BackgroundDialogProps) {
    const [isPending, startTransition] = useTransition()
    const [uploadingImage, setUploadingImage] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(
        editingBackground?.imageUrl ?? null
    )
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
        reset,
    } = useForm<FormValues>({
        resolver: zodResolver(backgroundFormSchema),
        defaultValues: editingBackground
            ? {
                name: editingBackground.name,
                imageUrl: editingBackground.imageUrl,
                acquisitionType: editingBackground.isDefault
                    ? 'free'
                    : editingBackground.conditionType === 'level'
                        ? 'level'
                        : 'coins',
                priceCoins: editingBackground.priceCoins ?? undefined,
                conditionValue: editingBackground.conditionValue ?? undefined,
            }
            : {
                name: '',
                imageUrl: '',
                acquisitionType: 'free',
            },
    })

    const acquisitionType = watch('acquisitionType')

    // Auto-reset price/condition when free is selected
    React.useEffect(() => {
        if (acquisitionType === 'free') {
            setValue('priceCoins', 0)
            setValue('conditionValue', undefined)
        }
    }, [acquisitionType, setValue])

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Preview
        const reader = new FileReader()
        reader.onloadend = () => {
            setPreviewImage(reader.result as string)
        }
        reader.readAsDataURL(file)
        setSelectedFile(file)

        // Upload immediately
        setUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const result = await uploadBackgroundImage(formData)

            if (result.success && result.url) {
                setValue('imageUrl', result.url, { shouldValidate: true })
                toast.success('图片上传成功')
            } else {
                toast.error(result.error || '上传失败')
                setPreviewImage(null)
                setSelectedFile(null)
            }
        } catch (error) {
            toast.error('上传失败')
            setPreviewImage(null)
            setSelectedFile(null)
        } finally {
            setUploadingImage(false)
        }
    }

    // Handle form submit
    const onSubmit = (data: FormValues) => {
        startTransition(async () => {
            try {
                const formData: BackgroundFormData = {
                    id: editingBackground?.id,
                    name: data.name,
                    imageUrl: data.imageUrl,
                    previewUrl: data.imageUrl, // use same as image for now
                    acquisitionType: data.acquisitionType,
                    priceCoins: data.acquisitionType === 'coins' ? data.priceCoins : 0,
                    conditionValue: data.acquisitionType === 'level' ? data.conditionValue : undefined,
                }

                const result = await upsertBackground(formData)

                if (result.success) {
                    toast.success(result.message || '保存成功')
                    onSuccess()
                    onOpenChange(false)
                    reset()
                    setPreviewImage(null)
                    setSelectedFile(null)
                } else {
                    toast.error(result.error || '保存失败')
                }
            } catch (error: any) {
                toast.error(error.message || '操作失败')
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-card text-foreground">
                <DialogHeader>
                    <DialogTitle>
                        {editingBackground ? '编辑背景' : '新增背景'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label>背景图片</Label>
                        <div className="flex items-center gap-3">
                            {previewImage ? (
                                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border">
                                    <Image
                                        src={previewImage}
                                        alt="预览"
                                        fill
                                        className="object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPreviewImage(null)
                                            setSelectedFile(null)
                                            setValue('imageUrl', '')
                                        }}
                                        className="absolute top-2 right-2 bg-black/50 rounded-full p-1 hover:bg-black/70 transition-colors"
                                    >
                                        <X className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex-1 h-40 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-cyan-500 transition-colors">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        disabled={uploadingImage}
                                    />
                                    {uploadingImage ? (
                                        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                点击上传图片
                                            </p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">
                                                JPG/PNG/WebP, 最大5MB
                                            </p>
                                        </>
                                    )}
                                </label>
                            )}
                        </div>
                        {errors.imageUrl && (
                            <p className="text-xs text-red-400">{errors.imageUrl.message}</p>
                        )}
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">名称</Label>
                        <Input
                            id="name"
                            {...register('name')}
                            placeholder="输入背景名称"
                            className="bg-background"
                        />
                        {errors.name && (
                            <p className="text-xs text-red-400">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Acquisition Type */}
                    <div className="space-y-2">
                        <Label htmlFor="acquisitionType">获取方式</Label>
                        <Select
                            value={acquisitionType}
                            onValueChange={(value) =>
                                setValue('acquisitionType', value as 'free' | 'coins' | 'level', {
                                    shouldValidate: true,
                                })
                            }
                        >
                            <SelectTrigger className="bg-background">
                                <SelectValue placeholder="选择获取方式" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="free">免费/默认</SelectItem>
                                <SelectItem value="coins">金币购买</SelectItem>
                                <SelectItem value="level">等级解锁</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.acquisitionType && (
                            <p className="text-xs text-red-400">
                                {errors.acquisitionType.message}
                            </p>
                        )}
                    </div>

                    {/* Conditional: Price (Coins) */}
                    {acquisitionType === 'coins' && (
                        <div className="space-y-2">
                            <Label htmlFor="priceCoins">价格 (金币)</Label>
                            <Input
                                id="priceCoins"
                                type="number"
                                {...register('priceCoins', { valueAsNumber: true })}
                                placeholder="例如: 100"
                                className="bg-background"
                            />
                            {errors.priceCoins && (
                                <p className="text-xs text-red-400">
                                    {errors.priceCoins.message}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Conditional: Level */}
                    {acquisitionType === 'level' && (
                        <div className="space-y-2">
                            <Label htmlFor="conditionValue">解锁等级</Label>
                            <Input
                                id="conditionValue"
                                type="number"
                                {...register('conditionValue', { valueAsNumber: true })}
                                placeholder="例如: 10"
                                className="bg-background"
                            />
                            {errors.conditionValue && (
                                <p className="text-xs text-red-400">
                                    {errors.conditionValue.message}
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                onOpenChange(false)
                                reset()
                                setPreviewImage(null)
                                setSelectedFile(null)
                            }}
                            disabled={isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={isPending || uploadingImage}>
                            {isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    保存中...
                                </>
                            ) : (
                                '保存'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

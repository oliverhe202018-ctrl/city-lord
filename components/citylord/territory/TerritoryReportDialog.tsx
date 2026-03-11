'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { submitTerritoryReport } from '@/app/actions/territory-report'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { TerritoryDetailResult } from '@/app/actions/territory-detail'

const reportFormSchema = z.object({
    reason: z.string().min(1, '请输入举报内容').max(500, '举报内容最多500字'),
})

type ReportFormValues = z.infer<typeof reportFormSchema>

interface TerritoryReportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    detail: TerritoryDetailResult
}

export function TerritoryReportDialog({ open, onOpenChange, detail }: TerritoryReportDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isValid }
    } = useForm<ReportFormValues>({
        resolver: zodResolver(reportFormSchema),
        defaultValues: {
            reason: '',
        },
        mode: 'onChange',
    })

    const onSubmit = async (data: ReportFormValues) => {
        if (!detail.owner?.id) return

        setIsSubmitting(true)

        // Capture simple state snapshot
        const snapshot = {
            territoryArea: detail.area,
            territoryCapturedAt: detail.capturedAt,
            cityName: detail.cityName,
            ownerNickname: detail.owner.nickname,
            clubName: detail.club?.name,
            recentRun: detail.recentRun
        }

        try {
            const result = await submitTerritoryReport({
                territoryId: detail.territoryId,
                reportedUserId: detail.owner.id,
                reason: data.reason,
                snapshot
            })

            if (result.success) {
                toast.success('举报已提交', {
                    description: '感谢您的反馈，我们会尽快处理。',
                })
                reset()
                onOpenChange(false)
            } else {
                toast.error('提交失败', {
                    description: result.error,
                })
            }
        } catch (error) {
            toast.error('提交失败', {
                description: '系统错误，请稍后重试',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen && !isSubmitting) {
            reset()
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>举报领地</DialogTitle>
                    <DialogDescription>
                        您正在举报领地 {detail.territoryId.substring(0, 6)} (领主: {detail.owner?.nickname || '神秘领主'})。请提供详细的举报原因。
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Input
                            id="reason"
                            placeholder="请输入举报原因 (例如: 轨迹作弊、名称违规、虚拟定位等)"
                            {...register('reason')}
                            disabled={isSubmitting}
                        />
                        {errors.reason && (
                            <p className="text-sm text-destructive font-medium">{errors.reason.message}</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !isValid}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            提交举报
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

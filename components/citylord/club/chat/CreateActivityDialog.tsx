'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Loader2, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createActivity } from '@/app/actions/club-activity.actions'
import type { ClubActivity } from '@/lib/types/club-chat.types'

interface CreateActivityDialogProps {
    clubId: string
    onClose: () => void
    onCreated: (activity: ClubActivity) => void
}

export function CreateActivityDialog({ clubId, onClose, onCreated }: CreateActivityDialogProps) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [location, setLocation] = useState('')
    const [maxParticipants, setMaxParticipants] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim()) {
            toast.error('请输入活动标题')
            return
        }
        if (!startTime || !endTime) {
            toast.error('请选择活动时间')
            return
        }
        if (new Date(endTime) <= new Date(startTime)) {
            toast.error('结束时间必须晚于开始时间')
            return
        }

        setIsSubmitting(true)
        const result = await createActivity({
            clubId,
            title: title.trim(),
            description: description.trim(),
            location: location.trim() || undefined,
            maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : undefined,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
        })
        setIsSubmitting(false)

        if (result.success) {
            toast.success('活动创建成功')
            onCreated(result.data)
        } else {
            toast.error(result.message)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-md mx-4 rounded-t-2xl sm:rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-yellow-400" />
                        <h3 className="text-sm font-semibold text-white">创建活动</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/5 text-white/40 hover:text-white/60 transition-colors"
                        id="close-create-activity"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                            活动标题 <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="输入活动标题"
                            maxLength={100}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-colors"
                            id="activity-title-input"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                            活动描述
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="描述活动的详细信息..."
                            maxLength={2000}
                            rows={3}
                            className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-colors resize-none"
                            id="activity-desc-input"
                        />
                    </div>

                    {/* Location + Max Participants */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-white/50 mb-1.5">
                                活动地点
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="可选"
                                maxLength={200}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-colors"
                                id="activity-location-input"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-white/50 mb-1.5">
                                最大人数
                            </label>
                            <input
                                type="number"
                                value={maxParticipants}
                                onChange={(e) => setMaxParticipants(e.target.value)}
                                placeholder="不限"
                                min={1}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-colors"
                                id="activity-max-input"
                            />
                        </div>
                    </div>

                    {/* Start + End time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-white/50 mb-1.5">
                                开始时间 <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-colors [color-scheme:dark]"
                                id="activity-start-input"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-white/50 mb-1.5">
                                结束时间 <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 transition-colors [color-scheme:dark]"
                                id="activity-end-input"
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <Button
                        type="submit"
                        disabled={isSubmitting || !title.trim() || !startTime || !endTime}
                        className="w-full h-10 bg-yellow-500/90 hover:bg-yellow-500 text-black font-medium text-sm disabled:opacity-40"
                        id="submit-activity"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <CalendarDays className="h-4 w-4 mr-1" />
                        )}
                        创建活动
                    </Button>
                </form>
            </div>
        </div>
    )
}

'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Send, CheckCircle2 } from 'lucide-react'
import { submitChangelogFeedback } from '@/app/actions/changelog/get-changelogs'

const FEEDBACK_TYPES = ['功能建议', '改进建议', 'Bug 反馈'] as const
type FeedbackType = typeof FEEDBACK_TYPES[number]

export default function ChangelogFeedbackPage() {
    const router = useRouter()
    const params = useParams()
    const version = params.version as string

    const [selectedType, setSelectedType] = useState<FeedbackType | null>(null)
    const [content, setContent]           = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess]       = useState(false)
    const [error, setError]               = useState<string | null>(null)

    const handleSubmit = async () => {
        if (!selectedType || content.trim().length < 5) return
        setIsSubmitting(true)
        setError(null)
        const result = await submitChangelogFeedback({
            feedbackType: selectedType,
            content,
            version,
        })
        setIsSubmitting(false)
        if (result.success) {
            setIsSuccess(true)
        } else {
            setError(result.error ?? '提交失败，请稍后再试')
        }
    }

    if (isSuccess) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-foreground">感谢你的反馈！</h2>
                <p className="mt-1 text-sm text-muted-foreground text-center">
                    我们会认真考虑每一条建议
                </p>
                <button
                    onClick={() => router.back()}
                    className="mt-6 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-medium text-white transition-colors active:bg-emerald-600"
                >
                    返回版本详情
                </button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
                <button
                    onClick={() => router.back()}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/20 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-foreground">提交反馈</h1>
                    <p className="text-xs text-muted-foreground">v{version}</p>
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* 反馈类型选择 */}
                <div>
                    <p className="mb-2.5 text-sm font-semibold text-foreground">反馈类型</p>
                    <div className="flex gap-2 flex-wrap">
                        {FEEDBACK_TYPES.map((type) => (
                            <button
                                key={type}
                                onClick={() => setSelectedType(type)}
                                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                                    selectedType === type
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'border-border bg-card/50 text-muted-foreground hover:bg-card'
                                }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 文字输入 */}
                <div>
                    <p className="mb-2 text-sm font-semibold text-foreground">详细描述</p>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="请详细描述你的想法或遇到的问题…（至少 5 个字）"
                        rows={6}
                        className="w-full rounded-xl border border-border bg-card/50 p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                    />
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                        {content.length} 字
                    </p>
                </div>

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}

                {/* 提交按钮 */}
                <button
                    onClick={handleSubmit}
                    disabled={!selectedType || content.trim().length < 5 || isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition-colors active:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <Send className="h-4 w-4" />
                    {isSubmitting ? '提交中…' : '提交反馈'}
                </button>
            </div>
        </div>
    )
}

'use client'
import Link from 'next/link'
import { X, Sparkles, ChevronRight } from 'lucide-react'
import type { UnreadVersion } from '@/app/actions/changelog/unread-actions'

interface Props {
    versions: UnreadVersion[]
    onDismiss: () => void
    onReadAll: () => void
}

export function ChangelogNewVersionSheet({ versions, onDismiss, onReadAll }: Props) {
    if (versions.length === 0) return null

    const latest = versions[0]
    const olderCount = versions.length - 1

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onDismiss}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                </div>

                <div className="px-5 pb-5 pt-2">
                    {/* Header */}
                    <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                                <Sparkles className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-base font-bold text-foreground">
                                    发现新版本 v{latest.version}
                                </p>
                                {latest.title && (
                                    <p className="text-xs text-muted-foreground">{latest.title}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onDismiss}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/40 transition-colors hover:bg-muted/60"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Preview items */}
                    {latest.item_previews.length > 0 && (
                        <div className="mb-4 space-y-2">
                            {latest.item_previews.map((item, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                        {item}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {olderCount > 0 && (
                        <p className="mb-4 text-xs text-muted-foreground">
                            另有 {olderCount} 个版本更新待查看
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onDismiss}
                            className="flex-1 rounded-xl border border-border bg-card/50 py-2.5 text-sm font-medium text-muted-foreground transition-colors active:bg-muted/20"
                        >
                            稍后再看
                        </button>
                        <Link
                            href={`/changelog/${latest.version}`}
                            onClick={onReadAll}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-600"
                        >
                            查看完整更新
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </>
    )
}

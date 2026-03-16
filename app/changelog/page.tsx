import Link from 'next/link'
import { ChevronRight, ScrollText, ArrowLeft } from 'lucide-react'
import { getChangelogs } from '@/app/actions/changelog/get-changelogs'

export default async function ChangelogPage() {
    const { data: versions, error } = await getChangelogs()

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
                <Link
                    href="/profile"
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/20 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </Link>
                <h1 className="text-lg font-bold text-foreground">功能更新日志</h1>
            </div>

            <div className="p-4 space-y-3">
                {error && (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        加载失败，请稍后再试
                    </p>
                )}

                {!error && (versions ?? []).length === 0 && (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        暂无更新日志
                    </p>
                )}

                {(versions ?? []).map((v) => (
                    <Link
                        key={v.id}
                        href={`/changelog/${v.version}`}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all active:bg-muted/10 hover:bg-card/80"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 shrink-0">
                                <ScrollText className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-bold text-foreground">
                                        v{v.version}
                                    </span>
                                    {v.is_latest && (
                                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                                            Latest
                                        </span>
                                    )}
                                </div>
                                {v.title && (
                                    <p className="text-xs text-muted-foreground">{v.title}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    {v.item_count} 项更新
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                    </Link>
                ))}
            </div>
        </div>
    )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, MessageSquarePlus } from 'lucide-react'
import { getChangelogDetail } from '@/app/actions/changelog/get-changelogs'
import { MarkVersionAsRead } from '@/components/changelog/MarkVersionAsRead'

const TAG_CONFIG: Record<string, { label: string; className: string }> = {
    new_feature: { label: '新功能',   className: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' },
    improvement: { label: '优化改进', className: 'bg-blue-500/15 text-blue-600 border border-blue-500/30' },
    bug_fix:     { label: '问题修复', className: 'bg-red-500/15 text-red-600 border border-red-500/30' },
}

export default async function ChangelogDetailPage({
    params,
}: {
    params: Promise<{ version: string }>
}) {
    const { version } = await params
    const { data, error } = await getChangelogDetail(version)

    if (error || !data) notFound()

    const releaseDate = new Date(data.release_date).toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric',
    })

    return (
        <div className="min-h-screen bg-background">
            <MarkVersionAsRead versionId={data.id} />
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
                <Link
                    href="/changelog"
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted/20 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-foreground" />
                </Link>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-foreground">v{data.version}</h1>
                        {data.is_latest && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                                Latest
                            </span>
                        )}
                    </div>
                    {data.title && (
                        <p className="text-xs text-muted-foreground">{data.title}</p>
                    )}
                </div>
            </div>

            <div className="p-4">
                {/* 发布时间 */}
                <p className="mb-4 text-xs text-muted-foreground">发布于 {releaseDate}</p>

                {/* 更新条目列表 */}
                <div className="space-y-3">
                    {data.items.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            此版本暂无详细说明
                        </p>
                    )}
                    {data.items.map((item) => {
                        const tag = TAG_CONFIG[item.tag] ?? {
                            label: item.tag,
                            className: 'bg-muted/50 text-muted-foreground border border-border',
                        }
                        return (
                            <div
                                key={item.id}
                                className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                            >
                                <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tag.className}`}
                                >
                                    {tag.label}
                                </span>
                                <p className="text-sm text-foreground leading-relaxed">
                                    {item.content}
                                </p>
                            </div>
                        )
                    })}
                </div>

                {/* 反馈入口 */}
                <Link
                    href={`/changelog/${version}/feedback`}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/50 p-3 transition-all active:bg-muted/10 hover:bg-card/80"
                >
                    <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">提交反馈或建议</span>
                </Link>

                {/* 上一页 / 下一页导航 */}
                <div className="mt-4 flex items-center justify-between gap-3">
                    {data.nextVersion ? (
                        <Link
                            href={`/changelog/${data.nextVersion.version}`}
                            className="flex flex-1 items-center gap-1.5 rounded-xl border border-border bg-card/50 p-3 transition-all hover:bg-card/80"
                        >
                            <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">上一页</p>
                                <p className="truncate text-sm font-medium text-foreground">
                                    v{data.nextVersion.version}
                                </p>
                            </div>
                        </Link>
                    ) : (
                        <div className="flex-1" />
                    )}

                    {data.prevVersion ? (
                        <Link
                            href={`/changelog/${data.prevVersion.version}`}
                            className="flex flex-1 items-center justify-end gap-1.5 rounded-xl border border-border bg-card/50 p-3 transition-all hover:bg-card/80"
                        >
                            <div className="min-w-0 text-right">
                                <p className="text-xs text-muted-foreground">下一页</p>
                                <p className="truncate text-sm font-medium text-foreground">
                                    v{data.prevVersion.version}
                                </p>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                    ) : (
                        <div className="flex-1" />
                    )}
                </div>
            </div>
        </div>
    )
}

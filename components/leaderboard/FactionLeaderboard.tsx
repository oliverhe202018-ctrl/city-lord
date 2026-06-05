'use client'

import { useEffect, useState, useTransition } from 'react'
import { getFactionLeaderboard, type FactionLeaderboardEntry } from '@/app/actions/faction'

function formatArea(m2: number): string {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`
  if (m2 >= 10_000)    return `${(m2 / 10_000).toFixed(1)} 万m²`
  return `${Math.round(m2).toLocaleString()} m²`
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function FactionLeaderboardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-muted/50" />
      ))}
    </div>
  )
}

interface FactionLeaderboardProps {
  initialData?: FactionLeaderboardEntry[]
  title?: string
  showMemberCount?: boolean
}

export function FactionLeaderboard({
  initialData,
  title = '阵营战力榜',
  showMemberCount = true,
}: FactionLeaderboardProps) {
  const [data, setData] = useState<FactionLeaderboardEntry[]>(initialData ?? [])
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialData && initialData.length > 0) return

    startTransition(async () => {
      try {
        const rows = await getFactionLeaderboard()
        setData(rows)
      } catch (e) {
        console.error(e)
        setError('数据加载失败，请刷新重试')
      }
    })
  }, [])

  const totalArea = data.reduce((sum, d) => sum + d.totalArea, 0)

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">实时领地占有率</span>
      </div>

      {error && (
        <p className="py-6 text-center text-sm text-destructive">{error}</p>
      )}

      {isPending && !error && <FactionLeaderboardSkeleton />}

      {!isPending && !error && data.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无阵营数据
        </p>
      )}

      {!isPending && !error && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((entry) => {
            const pct = totalArea > 0 ? (entry.totalArea / totalArea) * 100 : 0

            return (
              <li
                key={entry.faction}
                className="overflow-hidden rounded-xl border border-border bg-background p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg leading-none" aria-label={`第${entry.rank}名`}>
                    {RANK_BADGE[entry.rank] ?? `#${entry.rank}`}
                  </span>

                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden
                  />
                  <span className="flex-1 font-medium text-foreground">
                    {entry.displayName}
                  </span>

                  <span
                    className="text-sm font-semibold tabular-nums flex items-center gap-1.5"
                    style={{ color: entry.color }}
                  >
                    {formatArea(entry.totalArea)}
                  </span>
                </div>

                {entry.bonusPercent > 0 && (
                  <div className="mb-2 text-xs font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    👑 弱势保护加成 +{entry.bonusPercent}%
                  </div>
                )}

                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${entry.displayName} 占领比例 ${pct.toFixed(1)}%`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct.toFixed(2)}%`,
                      backgroundColor: entry.color,
                    }}
                  />
                </div>

                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>占有率 {pct.toFixed(1)}%</span>
                  {showMemberCount && (
                    <span>{entry.memberCount.toLocaleString()} 名领主</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

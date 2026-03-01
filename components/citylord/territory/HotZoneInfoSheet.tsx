"use client"

import React, { useState, useEffect } from "react"
import {
    X,
    Flame,
    Heart,
    TrendingUp,
    TrendingDown,
    Shield,
    Swords,
    Clock,
    AlertTriangle,
    Info,
    Timer,
} from "lucide-react"

// ============================================================
// HotZoneInfoSheet — Bottom Sheet with Rules + Dispute Log
//
// Full rules panel explaining:
//   - Territory HP system
//   - Hot zone criteria
//   - Score calculations with examples (0.5x hot zone)
//   - Daily attack limits
//   - Recent 7-day dispute log (R2-8)
// ============================================================

interface OwnerChangeEntry {
    previousOwner: string | null
    newOwner: string
    changedAt: Date
}

interface HotZoneInfoSheetProps {
    isOpen: boolean
    onClose: () => void
    /** Dispute log: recent ownership changes for display */
    recentChanges?: OwnerChangeEntry[]
    /** Total change count in 7-day window */
    recentChangeCount?: number
    /** Last owner change timestamp */
    lastChangeAt?: Date | null
}

export function HotZoneInfoSheet({
    isOpen,
    onClose,
    recentChanges = [],
    recentChangeCount = 0,
    lastChangeAt,
}: HotZoneInfoSheetProps) {
    const [isExiting, setIsExiting] = useState(false)

    const handleClose = () => {
        setIsExiting(true)
        setTimeout(() => {
            setIsExiting(false)
            onClose()
        }, 300)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isExiting ? "opacity-0" : "opacity-100"
                    }`}
                onClick={handleClose}
            />

            {/* Sheet */}
            <div
                className={`relative w-full max-w-lg transform overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#0f172a]/98 shadow-2xl backdrop-blur-xl transition-all duration-300 ${isExiting ? "translate-y-full" : "translate-y-0"
                    }`}
                style={{ maxHeight: "85vh" }}
            >
                {/* Handle */}
                <div className="flex justify-center py-3">
                    <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pb-4">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20">
                            <Info className="h-4 w-4 text-orange-400" />
                        </div>
                        <h2 className="text-lg font-bold text-white">领地攻防规则</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto px-6 pb-8" style={{ maxHeight: "calc(85vh - 100px)" }}>
                    {/* Section 1: 领地生命值 */}
                    <RuleSection icon={Heart} iconColor="text-emerald-400" title="领地生命值">
                        <RuleItem icon={Shield} text="每块领地初始 1000 HP" />
                        <RuleItem icon={Swords} text="跑步结算时，轨迹经过敌方领地自动扣 HP" />
                        <RuleItem icon={Clock} text="每人每天对同一领地仅可攻击一次" />
                        <RuleItem icon={AlertTriangle} text="HP 归零后进入 5 分钟中立冷却，然后可被他人占领" highlight />
                    </RuleSection>

                    {/* Section 2: 热门区域 */}
                    <RuleSection icon={Flame} iconColor="text-orange-400" title="热门区域">
                        <RuleItem icon={Flame} text="7 天内真实易主（A→B）≥ 2 次的区域标记为热门" />
                        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-2 px-3 text-left text-white/40 font-normal">项目</th>
                                        <th className="py-2 px-3 text-center text-white/40 font-normal">普通区域</th>
                                        <th className="py-2 px-3 text-center text-orange-400/80 font-normal">热门区域</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-white/5">
                                        <td className="py-2 px-3 text-white/60">占领积分</td>
                                        <td className="py-2 px-3 text-center text-white/70">×1.0</td>
                                        <td className="py-2 px-3 text-center font-bold text-yellow-400">×0.5</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 text-white/60">失去扣分</td>
                                        <td className="py-2 px-3 text-center text-white/70">50%</td>
                                        <td className="py-2 px-3 text-center font-bold text-red-400">50%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </RuleSection>

                    {/* Section 3: 积分计算 */}
                    <RuleSection icon={TrendingUp} iconColor="text-purple-400" title="积分计算示例">
                        <div className="space-y-2">
                            <ScoreExample
                                label="占领普通区域 (1km²)"
                                formula="1 × 1000 × 1.0"
                                result="+1000"
                                isPositive
                            />
                            <ScoreExample
                                label="占领热门区域 (1km²)"
                                formula="1 × 1000 × 0.5"
                                result="+500"
                                isPositive
                                isHot
                            />
                            <ScoreExample
                                label="失去普通区域 (得分 1000)"
                                formula="1000 × 50%"
                                result="-500"
                                isPositive={false}
                            />
                            <ScoreExample
                                label="失去热门区域 (得分 500)"
                                formula="500 × 50%"
                                result="-250"
                                isPositive={false}
                                isHot
                            />
                        </div>
                    </RuleSection>

                    {/* Section 4: 争夺日志 (R2-8) */}
                    <RuleSection icon={Timer} iconColor="text-cyan-400" title="近7天争夺日志">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="mb-2 flex items-center justify-between text-[10px] text-white/40">
                                <span>7 天内易主次数</span>
                                <span className={`font-mono font-bold ${recentChangeCount >= 2 ? "text-orange-400" : "text-white/60"}`}>
                                    {recentChangeCount} 次
                                </span>
                            </div>
                            {lastChangeAt && (
                                <div className="mb-3 flex items-center justify-between text-[10px] text-white/40">
                                    <span>最近易主时间</span>
                                    <span className="text-white/60">
                                        {formatTimeAgo(lastChangeAt)}
                                    </span>
                                </div>
                            )}

                            {recentChanges.length > 0 ? (
                                <div className="space-y-1.5 border-t border-white/5 pt-2">
                                    {recentChanges.map((change, i) => (
                                        <div key={i} className="flex items-center justify-between text-[10px]">
                                            <div className="flex items-center gap-1 text-white/50">
                                                <span className="text-red-400/60">
                                                    {change.previousOwner ? truncateId(change.previousOwner) : "无主"}
                                                </span>
                                                <span className="text-white/30">→</span>
                                                <span className="text-emerald-400/60">
                                                    {truncateId(change.newOwner)}
                                                </span>
                                            </div>
                                            <span className="text-white/30">
                                                {formatTimeAgo(change.changedAt)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-[10px] text-white/30 py-2">
                                    暂无争夺记录
                                </p>
                            )}
                        </div>
                    </RuleSection>

                    <RuleSection icon={Shield} iconColor="text-cyan-400" title="策略提示">
                        <RuleItem icon={Shield} text="定期跑步经过自己的领地可恢复 HP" />
                        <RuleItem icon={Swords} text="集中攻击对手领地的 HP 比直接占领更有效" />
                        <RuleItem icon={Flame} text="热门区域得分减半，谨慎投入争夺" />
                        <RuleItem icon={Timer} text="HP 归零后有 5 分钟冷却，不要急于进攻" />
                        <RuleItem icon={Info} text="积分仅用于攻击和占领领地时的收益，排行榜排名仅基于控制区域的数量。" highlight />
                    </RuleSection>
                </div>
            </div>
        </div>
    )
}

// ── Helpers ──

function formatTimeAgo(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return "刚刚"
    if (diffMin < 60) return `${diffMin}分钟前`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}小时前`
    const diffDay = Math.floor(diffHr / 24)
    return `${diffDay}天前`
}

function truncateId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 4)}...${id.slice(-4)}` : id
}

// ── Sub-components ──

function RuleSection({
    icon: Icon,
    iconColor,
    title,
    children,
}: {
    icon: React.ElementType
    iconColor: string
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${iconColor}`} />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <div className="ml-6">{children}</div>
        </div>
    )
}

function RuleItem({
    icon: Icon,
    text,
    highlight = false,
}: {
    icon: React.ElementType
    text: string
    highlight?: boolean
}) {
    return (
        <div className="flex items-start gap-2 py-1.5">
            <Icon
                className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${highlight ? "text-amber-400" : "text-white/30"
                    }`}
            />
            <span
                className={`text-xs leading-relaxed ${highlight ? "font-medium text-amber-300" : "text-white/60"
                    }`}
            >
                {text}
            </span>
        </div>
    )
}

function ScoreExample({
    label,
    formula,
    result,
    isPositive,
    isHot = false,
}: {
    label: string
    formula: string
    result: string
    isPositive: boolean
    isHot?: boolean
}) {
    return (
        <div className="rounded-lg bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/40">{label}</span>
                    {isHot && <Flame className="h-3 w-3 text-orange-400" />}
                </div>
                <span
                    className={`text-xs font-bold ${isPositive ? "text-emerald-400" : "text-red-400"
                        }`}
                >
                    {result}
                </span>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-white/30">
                {formula}
            </div>
        </div>
    )
}

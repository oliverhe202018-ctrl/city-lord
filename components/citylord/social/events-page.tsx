"use client"

import React from "react"
import { Calendar, Users, Trophy, ChevronRight, Timer, MapPin } from "lucide-react"

export function EventsPage() {
    const events = [
        {
            id: "ev1",
            title: "春季里程狂欢赛",
            type: "线上赛事",
            status: "进行中",
            participants: 12543,
            endTime: "3天后结束",
            reward: "限定春季奖牌 + 500金币",
            color: "from-green-500/20 to-emerald-500/20",
            icon: Trophy
        },
        {
            id: "ev2",
            title: "周末阵营地盘争夺战",
            type: "阵营战",
            status: "即将开始",
            participants: 8432,
            endTime: "周六 20:00 开始",
            reward: "阵营专属背景",
            color: "from-blue-500/20 to-purple-500/20",
            icon: MapPin
        },
        {
            id: "ev3",
            title: "连续7天早起打卡",
            type: "挑战活动",
            status: "报名中",
            participants: 3201,
            endTime: "下周一截止报名",
            reward: "稀有称号「晨间行者」",
            color: "from-orange-500/20 to-red-500/20",
            icon: Timer
        }
    ]

    return (
        <div className="space-y-4">
            {events.map(ev => {
                const Icon = ev.icon
                return (
                    <div key={ev.id} className="overflow-hidden rounded-2xl border border-border bg-card relative">
                        <div className={`absolute inset-0 bg-gradient-to-br ${ev.color} opacity-30`} />
                        <div className="p-4 relative">
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-sm uppercase tracking-wider ${ev.status === "进行中" ? "bg-green-500/20 text-green-500" :
                                    ev.status === "即将开始" ? "bg-amber-500/20 text-amber-500" :
                                        "bg-blue-500/20 text-blue-500"
                                    }`}>
                                    {ev.status}
                                </span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="w-3 h-3" /> {ev.participants.toLocaleString()} 人参与
                                </span>
                            </div>

                            <h3 className="text-xl font-bold mb-1 text-foreground">{ev.title}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mb-4">
                                <Calendar className="w-3 h-3" /> {ev.endTime}
                            </p>

                            <div className="bg-black/20 p-3 rounded-xl flex items-center justify-between backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-5 h-5 text-yellow-500" />
                                    <span className="text-sm font-bold text-foreground">{ev.reward}</span>
                                </div>
                                <button className="bg-foreground text-background px-4 py-1.5 rounded-lg text-sm font-bold active:scale-95 transition-all">
                                    查看详情
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

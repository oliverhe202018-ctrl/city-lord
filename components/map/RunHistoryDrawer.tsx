"use client"

import React, { useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer"
import { X, Calendar, MapPin, Clock, Flame, ChevronRight, Trophy, TrendingUp } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"

// Mock Data
const MOCK_RUNS = [
  {
    id: 1,
    date: new Date(2024, 1, 6, 18, 30),
    distance: 5.24, // km
    duration: 1845, // seconds (30m 45s)
    calories: 320,
    polygons: 12,
    mapSnapshot: "bg-gradient-to-br from-blue-900/50 to-indigo-900/50",
  },
  {
    id: 2,
    date: new Date(2024, 1, 4, 7, 15),
    distance: 3.12,
    duration: 1020, // 17m
    calories: 195,
    polygons: 8,
    mapSnapshot: "bg-gradient-to-br from-emerald-900/50 to-teal-900/50",
  },
  {
    id: 3,
    date: new Date(2024, 1, 1, 19, 45),
    distance: 8.56,
    duration: 2950,
    calories: 540,
    polygons: 24,
    mapSnapshot: "bg-gradient-to-br from-orange-900/50 to-red-900/50",
  },
]

interface RunHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function RunHistoryDrawer({ isOpen, onClose }: RunHistoryDrawerProps) {
  const [selectedRun, setSelectedRun] = useState<number | null>(null)

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatPace = (seconds: number, distance: number) => {
    const paceSeconds = seconds / distance
    const mins = Math.floor(paceSeconds / 60)
    const secs = Math.floor(paceSeconds % 60)
    return `${mins}'${secs.toString().padStart(2, '0')}"`
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh] bg-[#0a0f1a] border-t border-white/10">
        <DrawerHeader className="border-b border-white/10 pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-white text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              我的跑步记录
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <X className="h-4 w-4 text-white" />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col items-center">
              <span className="text-xs text-white/50 mb-1">总里程 (km)</span>
              <span className="text-xl font-bold text-emerald-400">128.5</span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col items-center">
              <span className="text-xs text-white/50 mb-1">总时长 (h)</span>
              <span className="text-xl font-bold text-blue-400">14.2</span>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/10 flex flex-col items-center">
              <span className="text-xs text-white/50 mb-1">总占领</span>
              <span className="text-xl font-bold text-yellow-400">456</span>
            </div>
          </div>

          <h3 className="text-sm font-medium text-white/50 mb-3 px-1">最近记录</h3>
          
          <div className="space-y-3">
            {MOCK_RUNS.map((run, index) => (
              <div 
                key={run.id}
                className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 active:scale-[0.98] transition-all duration-200"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Background Map Snapshot Mock */}
                <div className={`absolute inset-0 opacity-20 ${run.mapSnapshot}`} />
                
                <div className="relative p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                        <Calendar className="w-4 h-4 text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">
                          {format(run.date, 'MM月dd日', { locale: zhCN })} · 户外跑
                        </div>
                        <div className="text-xs text-white/50">
                          {format(run.date, 'HH:mm', { locale: zhCN })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-lg border border-yellow-500/30">
                      <MapPin className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs font-bold text-yellow-500">+{run.polygons}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pl-1">
                    <div>
                      <div className="text-2xl font-bold text-white font-mono tracking-tight">
                        {run.distance}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">公里</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white/90 font-mono mt-1">
                        {formatPace(run.duration, run.distance)}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">配速</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white/90 font-mono mt-1">
                        {formatDuration(run.duration)}
                      </div>
                      <div className="text-xs text-white/40 mt-0.5">时长</div>
                    </div>
                  </div>

                  <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight className="w-5 h-5 text-white/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-6">
            <button className="text-xs text-white/30 flex items-center justify-center gap-1 mx-auto hover:text-white/50 transition-colors">
              <TrendingUp className="w-3 h-3" />
              查看更多历史数据
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

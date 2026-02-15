"use client"

import React, { useEffect, useState } from "react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer"
import { X, Calendar, MapPin, ChevronRight, Trophy, TrendingUp, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { toast } from "sonner"
import Link from "next/link"

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const getRecentActivities = async (limit: number = 5) => {
  const res = await fetchWithTimeout(`/api/activities/get-recent-activities?limit=${limit}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch activities')
  return await res.json()
}

interface Activity {
  id: string
  created_at: string
  distance: number
  duration: number
  area: number
}

interface RunHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export function RunHistoryDrawer({ isOpen, onClose }: RunHistoryDrawerProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [snapPoint, setSnapPoint] = useState<number | string | null>(1)

  useEffect(() => {
    if (isOpen) {
      const fetchActivities = async () => {
        setLoading(true)
        try {
          const data = await getRecentActivities(5)
          setActivities(data || [])
        } catch (error) {
          console.error(error)
          toast.error("加载记录失败")
        } finally {
          setLoading(false)
        }
      }
      fetchActivities()
    }
  }, [isOpen])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatPace = (seconds: number, distance: number) => {
    if (!distance || distance <= 0) return "--'--\""
    const paceSeconds = seconds / distance
    const mins = Math.floor(paceSeconds / 60)
    const secs = Math.floor(paceSeconds % 60)
    return `${mins}'${secs.toString().padStart(2, '0')}"`
  }

  // Calculate totals from fetched data or user profile store?
  // The user prompt didn't ask to change the summary stats at the top, but it's weird if they are hardcoded.
  // However, the prompt specifically focused on "列表限制与底部按钮" and "接入真实数据" for the LIST.
  // I will leave the summary stats as is for now or use the fetched data to sum up (but fetched is only 5 items).
  // Ideally, these should come from `getUserProfileStats`.
  // For now I will focus on the list as requested.
  // But to be clean, I should probably hide or mock the top stats properly or fetch them.
  // The existing code has hardcoded stats. I'll leave them or maybe replace with "..." if I can't fetch.
  // Actually, I can use the existing `MOCK_RUNS` variable to infer I should replace it.
  // I'll keep the top stats structure but maybe comment out or leave hardcoded as "Total" stats usually come from a different API.
  // The user didn't explicitly ask to fix the summary cards.

  return (
    <Drawer 
      open={isOpen} 
      onOpenChange={onClose} 
      snapPoints={[0.4, 1]}
      activeSnapPoint={snapPoint}
      onActiveSnapPointChange={setSnapPoint}
      dismissible={true}
    >
      <DrawerContent className="h-[96vh] flex flex-col bg-zinc-950 border-t border-zinc-800">
        <DrawerHeader className="border-b border-white/10 pb-4 flex-none">
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

        <div className="flex-1 overflow-y-auto p-4">
          {/* Summary Stats - Keep as placeholder or remove if not needed. Leaving as is per scope */}
          {/* 
          <div className="grid grid-cols-3 gap-3 mb-6">
             ...
          </div>
          */}

          <h3 className="text-sm font-medium text-white/50 mb-3 px-1">最近记录</h3>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">
              暂无跑步记录
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((run, index) => (
                <div 
                  key={run.id}
                  className="group relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 active:scale-[0.98] transition-all duration-200"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="relative p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                          <Calendar className="w-4 h-4 text-white/80" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">
                            {format(new Date(run.created_at), 'MM月dd日', { locale: zhCN })} · 户外跑
                          </div>
                          <div className="text-xs text-white/50">
                            {format(new Date(run.created_at), 'HH:mm', { locale: zhCN })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-1 rounded-lg border border-yellow-500/30">
                        <MapPin className="w-3 h-3 text-yellow-500" />
                        {/* Task 2: Show Area instead of Polygons */}
                        <span className="text-xs font-bold text-yellow-500">
                           {run.area ? Number(run.area).toFixed(2) : 0} m²
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pl-1">
                      <div>
                        <div className="text-2xl font-bold text-white font-mono tracking-tight">
                          {run.distance ? run.distance.toFixed(2) : '0.00'}
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
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Task 3: Footer Button */}
          <div className="mt-4 pb-6">
            <button 
              onClick={() => {
                // Task 3: Check more history
                toast("功能开发中")
              }}
              className="w-full py-4 text-sm text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              <TrendingUp className="w-4 h-4" />
              查看更多历史数据
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

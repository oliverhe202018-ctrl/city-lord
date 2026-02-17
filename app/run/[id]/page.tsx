"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import useEmblaCarousel from 'embla-carousel-react'
import { StaticTrajectoryMap } from "@/components/running/StaticTrajectoryMap"
import { getRunDetail } from "@/app/actions/activities"
import { Loader2, ChevronLeft, Zap, TrendingUp } from "lucide-react"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

/** Safe number formatting — prevents infinite decimals and NaN/undefined */
function safeNum(val: any, decimals = 2, fallback = '--'): string {
   const n = Number(val)
   if (!Number.isFinite(n)) return fallback
   return n.toFixed(decimals)
}

export default function RunDetailPage() {
   const params = useParams()
   const router = useRouter()
   const [run, setRun] = useState<any>(null)
   const [loading, setLoading] = useState(true)
   const [emblaRef, emblaApi] = useEmblaCarousel()
   const [slideIndex, setSlideIndex] = useState(0)

   useEffect(() => {
      if (emblaApi) {
         emblaApi.on('select', () => {
            setSlideIndex(emblaApi.selectedScrollSnap())
         })
      }
   }, [emblaApi])

   useEffect(() => {
      const fetchRun = async () => {
         if (params.id) {
            const data = await getRunDetail(params.id as string)
            setRun(data)
            setLoading(false)
         }
      }
      fetchRun()
   }, [params.id])

   if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>
   if (!run) return <div className="h-screen bg-black flex items-center justify-center text-white">未找到跑步记录</div>

   const avgSpeed = safeNum(run.distance_km / (run.duration / 3600), 1)
   const maxSpeed = safeNum(parseFloat(avgSpeed !== '--' ? avgSpeed : '0') * 1.2, 1)
   const dateStr = (() => {
      try { return format(new Date(run.created_at), 'yyyy年MM月dd日 HH:mm') } catch { return '--' }
   })()
   const shortDate = (() => {
      try { return format(new Date(run.created_at), 'MM月dd日') } catch { return '--' }
   })()

   return (
      <div className="h-screen bg-black text-white overflow-y-auto">
         {/* Header */}
         <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-transparent pointer-events-none">
            <button onClick={() => router.back()} className="pointer-events-auto p-2 rounded-full bg-black/40 backdrop-blur-md">
               <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div className="text-sm font-bold uppercase tracking-wider bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
               {shortDate}
            </div>
            <div className="w-10" />
         </div>

         {/* Slider */}
         <div className="overflow-hidden bg-zinc-900" ref={emblaRef}>
            <div className="flex">
               {/* Slide 1: Map */}
               <div className="flex-[0_0_100%] min-w-0 relative h-[60vh]">
                  {run.path ? (
                     <StaticTrajectoryMap path={run.path} className="w-full h-full" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-white/30">暂无轨迹数据</div>
                  )}
               </div>
               {/* Slide 2: Splits */}
               <div className="flex-[0_0_100%] min-w-0 relative h-[60vh] bg-zinc-900 p-6 flex flex-col justify-center">
                  <h3 className="text-center mb-6 font-bold text-lg">配速分段</h3>
                  {run.splits && run.splits.length > 0 ? (
                     <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={run.splits}>
                              <XAxis dataKey="km" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis hide />
                              <Tooltip
                                 contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px' }}
                                 itemStyle={{ color: '#fff' }}
                                 cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                 formatter={(value: any, name: any, props: any) => [props.payload.pace, '配速']}
                              />
                              <Bar dataKey="seconds" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                           </BarChart>
                        </ResponsiveContainer>
                     </div>
                  ) : (
                     <div className="flex-1 flex items-center justify-center text-white/30">暂无分段数据</div>
                  )}
               </div>
            </div>
         </div>

         {/* Pagination Dots */}
         <div className="flex justify-center gap-2 mt-4">
            {[0, 1].map(i => (
               <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? 'bg-white' : 'bg-white/20'}`} />
            ))}
         </div>

         {/* Info Card — Flexbox column layout to prevent overlap */}
         <div className="px-4 mt-6 pb-10">
            <div className="text-xl font-bold mb-1">{dateStr}</div>
            <div className="text-sm text-white/50 mb-6">自由跑</div>

            {/* Primary Stats — flex column on small screens, each stat stacks naturally */}
            <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10">
               <div className="flex flex-col items-center gap-y-4">
                  {/* Distance */}
                  <div className="text-center w-full">
                     <div className="text-3xl font-bold font-mono">{safeNum(run.distance_km, 2)}<span className="text-base font-normal text-white/40 ml-1">KM</span></div>
                     <div className="text-xs text-white/40 tracking-wider mt-1">距离</div>
                  </div>
                  <div className="w-full h-px bg-white/10" />
                  {/* Duration */}
                  <div className="text-center w-full">
                     <div className="text-3xl font-bold font-mono">{run.duration_str || '--'}</div>
                     <div className="text-xs text-white/40 tracking-wider mt-1">时长</div>
                  </div>
                  <div className="w-full h-px bg-white/10" />
                  {/* Avg Pace */}
                  <div className="text-center w-full">
                     <div className="text-3xl font-bold font-mono">{run.pace_min_per_km || '--'}</div>
                     <div className="text-xs text-white/40 tracking-wider mt-1">平均配速</div>
                  </div>
               </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 gap-4 mt-4">
               <div className="bg-zinc-900 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                  <div>
                     <div className="text-xs text-white/40 tracking-wider mb-1">平均速度</div>
                     <div className="text-xl font-bold font-mono">{avgSpeed} <span className="text-xs font-normal text-white/40">km/h</span></div>
                  </div>
                  <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0" />
               </div>
               <div className="bg-zinc-900 rounded-2xl p-4 border border-white/10 flex items-center justify-between">
                  <div>
                     <div className="text-xs text-white/40 tracking-wider mb-1">最大速度</div>
                     <div className="text-xl font-bold font-mono">{maxSpeed} <span className="text-xs font-normal text-white/40">km/h</span></div>
                  </div>
                  <TrendingUp className="w-5 h-5 text-red-500 flex-shrink-0" />
               </div>
            </div>
         </div>
      </div>
   )
}

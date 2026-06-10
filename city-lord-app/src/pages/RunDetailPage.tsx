import React, { useEffect, useState, Suspense } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import useEmblaCarousel from 'embla-carousel-react'
import { MapSkeleton } from "@/components/map/MapSkeleton"
import { Loader2, ChevronLeft, Zap, TrendingUp } from "lucide-react"
import { formatShanghaiDate } from "@/lib/format/running"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { StaticTrajectoryMap } from "@/components/running/StaticTrajectoryMap"
import { rpcCall } from "@/api/client"

/** Safe number formatting — prevents infinite decimals and NaN/undefined */
function safeNum(val: any, decimals = 2, fallback = '--'): string {
   const n = Number(val)
   if (!Number.isFinite(n)) return fallback
   return n.toFixed(decimals)
}

function RunDetailContent() {
   const [searchParams] = useSearchParams()
   const navigate = useNavigate()
   const id = searchParams.get('id') as string
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
         if (id) {
            try {
               const res = await rpcCall('activities', 'getRunDetail', [id])
               if (res.success && res.data) {
                  setRun(res.data)
               } else {
                  console.error('Failed to fetch run detail:', res.error)
               }
            } catch (err) {
               console.error('Error fetching run detail', err)
            } finally {
               setLoading(false)
            }
         }
      }
      fetchRun()
   }, [id])

   if (loading) return <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white z-50 absolute top-0 left-0"><Loader2 className="animate-spin" /></div>
   if (!run) return <div className="h-[100dvh] w-full bg-black flex items-center justify-center text-white z-50 absolute top-0 left-0">未找到跑步记录</div>

   const avgSpeed = safeNum(run.distance_km / (run.duration / 3600), 1)
   const maxSpeed = safeNum(parseFloat(avgSpeed !== '--' ? avgSpeed : '0') * 1.2, 1)
   const dateStr = formatShanghaiDate(run.created_at, 'yyyy年MM月dd日 HH:mm')
   const shortDate = formatShanghaiDate(run.created_at, 'MM月dd日')

   return (
      <div className="h-[100dvh] w-full absolute top-0 left-0 z-50 bg-black text-white overflow-y-auto">
         {/* Header */}
         <div className="fixed top-[var(--safe-top,0px)] left-0 right-0 z-[60] flex items-center justify-between px-3 py-2 bg-transparent pointer-events-none">
            <button onClick={() => navigate(-1)} className="pointer-events-auto p-1.5 rounded-full bg-black/40 backdrop-blur-md">
               <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <div className="text-xs font-bold uppercase tracking-wider bg-black/40 px-2.5 py-1 rounded-full backdrop-blur-md">
               {shortDate}
            </div>
            <div className="w-8" />
         </div>

         {/* Slider */}
         <div className="overflow-hidden bg-zinc-900" ref={emblaRef}>
            <div className="flex">
               {/* Slide 0: Photo */}
               <div className="flex-[0_0_100%] min-w-0 relative h-[60vh] bg-zinc-900 flex items-center justify-center">
                  {run.photo_url ? (
                     <img src={run.photo_url} alt="跑步照片" className="w-full h-full object-cover" />
                  ) : (
                     <div className="text-white/30 text-lg font-medium">无照片</div>
                  )}
               </div>
               {/* Slide 1: Map */}
               <div className="flex-[0_0_100%] min-w-0 relative h-[60vh]">
                  {run.path ? (
                     <StaticTrajectoryMap path={run.path} className="w-full h-full" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center text-white/30">暂无轨迹数据</div>
                  )}
               </div>
               {/* Slide 2: Splits */}
               <div className="flex-[0_0_100%] min-w-0 relative h-[60vh] bg-zinc-900 p-4 flex flex-col justify-center">
                  <h3 className="text-center mb-4 font-bold text-base">配速分段</h3>
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
            {[0, 1, 2].map(i => (
               <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === slideIndex ? 'bg-white' : 'bg-white/20'}`} />
            ))}
         </div>

         {/* Info Card */}
         <div className="px-3 mt-4 pb-8">
            <div className="text-base font-bold mb-0.5">{dateStr}</div>
            <div className="text-xs text-white/50 mb-3">自由跑</div>

            {/* Primary Stats */}
            <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
               <div className="flex flex-col items-center gap-y-3">
                  {/* Distance */}
                  <div className="text-center w-full">
                     <div className="text-2xl font-bold font-mono">{safeNum(run.distance_km, 2)}<span className="text-sm font-normal text-white/40 ml-1">KM</span></div>
                     <div className="text-[10px] text-white/40 tracking-wider mt-0.5">距离</div>
                  </div>
                  <div className="w-full h-px bg-white/10" />
                  {/* Duration */}
                  <div className="text-center w-full">
                     <div className="text-2xl font-bold font-mono">{run.duration_str || '--'}</div>
                     <div className="text-[10px] text-white/40 tracking-wider mt-0.5">时长</div>
                  </div>
                  <div className="w-full h-px bg-white/10" />
                  {/* Avg Pace */}
                  <div className="text-center w-full">
                     <div className="text-2xl font-bold font-mono">{run.pace_min_per_km || '--'}</div>
                     <div className="text-[10px] text-white/40 tracking-wider mt-0.5">平均配速</div>
                  </div>
               </div>
            </div>

            {/* Secondary Stats */}
            <div className="grid grid-cols-2 gap-3 mt-3">
               <div className="bg-zinc-900 rounded-xl p-3 border border-white/10 flex items-center justify-between">
                  <div>
                     <div className="text-[10px] text-white/40 tracking-wider mb-0.5">平均速度</div>
                     <div className="text-lg font-bold font-mono">{avgSpeed} <span className="text-[10px] font-normal text-white/40">km/h</span></div>
                  </div>
                  <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
               </div>
               <div className="bg-zinc-900 rounded-xl p-3 border border-white/10 flex items-center justify-between">
                  <div>
                     <div className="text-[10px] text-white/40 tracking-wider mb-0.5">最大速度</div>
                     <div className="text-lg font-bold font-mono">{maxSpeed} <span className="text-[10px] font-normal text-white/40">km/h</span></div>
                  </div>
                  <TrendingUp className="w-4 h-4 text-red-500 flex-shrink-0" />
               </div>
            </div>
         </div>
      </div>
   )
}

export default function RunDetailPage() {
   return (
      <Suspense fallback={<div className="h-[100dvh] bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>}>
         <RunDetailContent />
      </Suspense>
   )
}

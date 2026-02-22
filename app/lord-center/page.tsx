"use client"

// Force dynamic rendering to skip static generation at build time
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import React, { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, Settings, Heart, MoreVertical, TrendingUp, Footprints, Clock, MapPin, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useGameStore } from "@/store/useGameStore"
import { getRecentActivities } from "@/app/actions/activities"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { calculateLevel } from "@/lib/game-logic/level-system"
import { useUserBadges } from "@/hooks/useGameData"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { toast } from "sonner"

export default function LordCenterPage() {
   const router = useRouter()
   const { userStats, nickname, avatar, userId } = useGameStore()
   const [activities, setActivities] = useState<any[]>([])
   const [loading, setLoading] = useState(true)
   const [bgImage, setBgImage] = useState("/images/lord-center-bg-default.jpg") // Default placeholder
   const [isBgSettingsOpen, setIsBgSettingsOpen] = useState(false)

   useEffect(() => {
      const fetchData = async () => {
         if (userId) {
            try {
               const acts = await getRecentActivities(userId, 20)
               setActivities(acts)
            } catch (e) {
               console.error(e)
            } finally {
               setLoading(false)
            }
         }
      }
      fetchData()
   }, [userId])

   // Defensive coding: Ensure userStats exists to prevent build-time errors
   if (!userStats) {
      return null
   }

   // Mock Photos for the top grid (Step 2 photos)
   const photos = [
      "/placeholder-photo-1.jpg",
      "/placeholder-photo-2.jpg",
      "/placeholder-photo-3.jpg",
   ]

   const level = calculateLevel(userStats?.xp || 0)

   // Mock Weekly Data
   const weeklyData = [
      { day: 'Dec', val: 85.1 },
      { day: '15.5', val: 35.5 },
      { day: '39.2', val: 39.2 },
      { day: '36.2', val: 36.2 },
      { day: '38.9', val: 38.9 },
      { day: '28.8', val: 28.8 },
      { day: 'Jan', val: 97.9 },
      { day: '105.1', val: 105.1 },
      { day: '67.6', val: 67.6 },
      { day: '114.2', val: 114.2 },
      { day: 'Feb', val: 47.4 },
      { day: '44.3', val: 44.3 },
   ]

   const handleBgChange = (url: string) => {
      setBgImage(url)
      setIsBgSettingsOpen(false)
      toast.success("背景图片已更新")
      // In real app, save to backend
   }

   return (
      <div className="h-screen bg-black text-white flex flex-col">
         {/* Top Navigation */}
         <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-transparent pointer-events-none">
            <button onClick={() => router.back()} className="pointer-events-auto p-2 rounded-full bg-black/40 backdrop-blur-md">
               <ChevronLeft className="w-6 h-6 text-white" />
            </button>
         </div>

         <div className="flex-grow overflow-y-auto pb-20">

            {/* Top Photo Grid */}
            <div className="grid grid-cols-4 h-32 gap-0.5">
               {photos.map((src, i) => (
                  <div key={i} className="relative h-full bg-zinc-800">
                     {/* Use a placeholder div if image fails or mock */}
                     <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center text-xs text-white/20">Photo {i + 1}</div>
                     {/* <Image src={src} alt="Photo" fill className="object-cover" /> */}
                  </div>
               ))}
               <div className="relative h-full bg-black flex items-center justify-center cursor-pointer hover:bg-zinc-900 transition-colors">
                  <span className="text-sm font-medium text-white">查看所有</span>
               </div>
            </div>

            {/* Profile Header */}
            <div className="relative">
               {/* Background Image */}
               <div className="h-64 w-full relative">
                  <div className="absolute inset-0 bg-zinc-800 overflow-hidden">
                     <img src={bgImage} className="w-full h-full object-cover opacity-60" alt="Background" />
                  </div>

                  {/* Settings Button */}
                  <div className="absolute top-4 right-4 z-10">
                     <Dialog open={isBgSettingsOpen} onOpenChange={setIsBgSettingsOpen}>
                        <DialogTrigger asChild>
                           <button className="p-2 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors">
                              <Settings className="w-5 h-5 text-white" />
                           </button>
                        </DialogTrigger>
                        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                           <DialogHeader>
                              <DialogTitle>设置背景图片</DialogTitle>
                           </DialogHeader>
                           <div className="grid grid-cols-2 gap-4 mt-4">
                              {/* Mock Background Options */}
                              {['/bg1.jpg', '/bg2.jpg', '/bg3.jpg', '/bg4.jpg'].map((bg, i) => (
                                 <button key={i} onClick={() => handleBgChange(bg)} className="aspect-video bg-zinc-800 rounded-lg border border-zinc-700 hover:border-cyan-400 transition-all overflow-hidden relative">
                                    <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">Theme {i + 1}</div>
                                 </button>
                              ))}
                           </div>
                        </DialogContent>
                     </Dialog>
                  </div>

                  {/* Likes */}
                  <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                     <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                     <span className="text-sm font-bold">1,024</span>
                  </div>
               </div>

               {/* Avatar & Info - Overlapping */}
               <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <div className="relative w-24 h-24 rounded-full border-4 border-black overflow-hidden bg-zinc-800">
                     {avatar ? <img src={avatar} alt={nickname || "User"} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl font-bold">{nickname?.[0]}</div>}
                  </div>
                  <div className="mt-2 text-center">
                     <h1 className="text-xl font-bold text-white flex items-center gap-2 justify-center">
                        {nickname || "Runner"}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/20">Lv.{level}</span>
                     </h1>
                  </div>
               </div>
            </div>

            {/* Stats Bar */}
            <div className="mt-20 px-6">
               <div className="flex items-center justify-between">
                  <div className="text-center">
                     <div className="text-lg font-bold">23</div>
                     <div className="text-xs text-white/50">Following</div>
                  </div>
                  <div className="text-center">
                     <div className="text-lg font-bold">25</div>
                     <div className="text-xs text-white/50">Followers</div>
                  </div>

                  <div className="flex items-center gap-2">
                     <Button className="bg-rose-500 hover:bg-rose-600 text-white rounded-full px-6 h-9">Follow</Button>
                     <button className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center">
                        <MoreVertical className="w-4 h-4 text-white" />
                     </button>
                  </div>
               </div>

               <div className="flex justify-between mt-8 px-4">
                  <div className="text-center">
                     <div className="text-3xl font-bold">{userStats.totalRuns}</div>
                     <div className="text-xs text-white/50">Total runs</div>
                  </div>
                  <div className="text-center">
                     <div className="text-3xl font-bold">{userStats.totalDistance.toFixed(2)}</div>
                     <div className="text-xs text-white/50">Distance (km)</div>
                  </div>
               </div>

               {/* Pace Stats */}
               <div className="grid grid-cols-3 gap-4 mt-8 text-center">
                  <div>
                     <div className="text-xl font-bold">5:47</div>
                     <div className="text-xs text-white/50">1km PB</div>
                  </div>
                  <div>
                     <div className="text-xl font-bold">29:30</div>
                     <div className="text-xs text-white/50">5km PB</div>
                  </div>
                  <div>
                     <div className="text-xl font-bold">59:10</div>
                     <div className="text-xs text-white/50">10km PB</div>
                  </div>
               </div>
            </div>

            {/* Weekly Distance Chart */}
            <div className="mt-10 px-4">
               <h3 className="text-sm font-bold mb-4">Weekly distance (km)</h3>
               <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={weeklyData}>
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#666' }} interval={0} />
                        <Tooltip
                           contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px' }}
                           itemStyle={{ color: '#fff' }}
                        />
                        <Line
                           type="monotone"
                           dataKey="val"
                           stroke="#f43f5e"
                           strokeWidth={2}
                           dot={{ r: 4, fill: '#333', stroke: '#fff', strokeWidth: 2 }}
                           activeDot={{ r: 6, fill: '#f43f5e' }}
                        />
                     </LineChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Run List */}
            <div className="mt-8 px-4 space-y-4">
               {loading ? (
                  <div className="flex justify-center py-10">
                     <Loader2 className="w-8 h-8 animate-spin text-white/30" />
                  </div>
               ) : activities.length > 0 ? (
                  activities.map(run => (
                     <Link href={`/run/detail?id=${run.id}`} key={run.id} className="block bg-zinc-900 rounded-xl overflow-hidden active:scale-[0.99] transition-transform">
                        <div className="h-24 bg-zinc-800 relative">
                           {/* Map Placeholder */}
                           <div className="absolute inset-0 flex items-center justify-center text-white/10">
                              <MapPin className="w-8 h-8" />
                           </div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                           <div>
                              <div className="text-lg font-bold text-white">{run.distance_km?.toFixed(2)} KM</div>
                              <div className="text-xs text-white/50">Distance</div>
                           </div>
                           <div>
                              <div className="text-lg font-bold text-white">{run.duration_str}</div>
                              <div className="text-xs text-white/50">Duration</div>
                           </div>
                           <div>
                              <div className="text-lg font-bold text-white">{run.pace_min_per_km}/km</div>
                              <div className="text-xs text-white/50">Avg pace</div>
                           </div>
                        </div>
                        <div className="px-4 pb-3 text-xs text-white/30 border-t border-white/5 pt-2">
                           {new Date(run.created_at).toLocaleDateString()}
                        </div>
                     </Link>
                  ))
               ) : (
                  <div className="text-center text-white/30 py-10">暂无记录</div>
               )}
            </div>
         </div>
      </div>
   )
}

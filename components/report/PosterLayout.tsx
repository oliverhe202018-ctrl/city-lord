'use client'

import { useRef, useState } from 'react'
import type { ReportStats } from '@/app/actions/report'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatsCard } from './StatsCard'
import { ReportChart } from './ReportChart'
import { Footprints, Flame, MapPin, Trophy, Download, Share2, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import html2canvas from 'html2canvas'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface PosterLayoutProps {
  stats: ReportStats
  onClose?: () => void
}

export function PosterLayout({ stats, onClose }: PosterLayoutProps) {
  const posterRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = async () => {
    if (!posterRef.current) return
    setIsGenerating(true)
    
    try {
      // Small delay to ensure charts are rendered
      await new Promise(resolve => setTimeout(resolve, 500))

      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: 2, // Retina support
        backgroundColor: '#09090b', // zinc-950
        logging: false,
      })

      const dataUrl = canvas.toDataURL('image/png')
      
      // Trigger download
      const link = document.createElement('a')
      link.download = `city-lord-report-${stats.dateRange.start.toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
      
      toast.success('战报已保存到相册')
    } catch (e) {
      console.error('Poster generation failed', e)
      toast.error('生成海报失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  const dateStr = format(stats.dateRange.start, 'yyyy年MM月dd日', { locale: zhCN })
  const inviteLink = `https://citylord.game/join?ref=${stats.user.referralCode}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-md bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        
        {/* Header Actions */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button size="icon" variant="secondary" className="rounded-full bg-black/50 backdrop-blur-md" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Poster Content Area (Ref for Capture) */}
        <div ref={posterRef} className="bg-zinc-950 text-white p-6 pb-8 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-600/20 to-transparent pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16 border-2 border-blue-500 shadow-lg">
              <AvatarImage src={stats.user.avatarUrl} crossOrigin="anonymous" />
              <AvatarFallback>{stats.user.nickname[0]}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-bold italic">{stats.user.nickname}</h2>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-bold">LV.{stats.user.level}</span>
                <span>{dateStr} 战报</span>
              </div>
            </div>
          </div>

          {/* Core Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
             <StatsCard 
               icon={Footprints} 
               label="累计里程" 
               value={stats.summary.distance} 
               unit="km" 
               trend={stats.period !== 'daily' ? stats.growth.distanceChange : undefined}
               className="bg-zinc-900/80 border-zinc-800"
             />
             <StatsCard 
               icon={Flame} 
               label="消耗热量" 
               value={stats.summary.calories} 
               unit="kcal" 
               className="bg-zinc-900/80 border-zinc-800"
             />
             <StatsCard 
               icon={MapPin} 
               label="新占领地" 
               value={stats.summary.newTerritories} 
               unit="个" 
               className="bg-zinc-900/80 border-zinc-800"
             />
             <StatsCard 
               icon={Trophy} 
               label="获得勋章" 
               value={stats.summary.newBadges} 
               unit="枚" 
               className="bg-zinc-900/80 border-zinc-800"
             />
          </div>

          {/* Charts Area */}
          <div className="space-y-4 mb-6 relative z-10">
             {/* Radar Chart */}
             <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2 tracking-wider">能力维数</h3>
                <ReportChart type="radar" data={stats} height={180} />
             </div>

             {/* Line Chart (Only if not daily or has data) */}
             {stats.chart.length > 1 && (
               <div className="bg-zinc-900/50 rounded-2xl p-4 border border-zinc-800">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase mb-2 tracking-wider">里程趋势</h3>
                  <ReportChart type="line" data={stats} height={120} />
               </div>
             )}
          </div>

          {/* Footer / QR Code */}
          <div className="flex items-end justify-between mt-8 pt-6 border-t border-white/10 relative z-10">
             <div>
                <div className="text-xl font-black italic tracking-tighter text-blue-500">CITY LORD</div>
                <div className="text-xs text-zinc-500 mt-1 max-w-[140px]">
                   加入我的阵营，一起争夺城市领地！
                </div>
                <div className="text-[10px] text-zinc-600 mt-2 font-mono">
                   Ref: {stats.user.referralCode}
                </div>
             </div>
             <div className="bg-white p-1.5 rounded-lg">
                <QRCodeSVG value={inviteLink} size={80} level="M" />
             </div>
          </div>
        </div>

        {/* Action Buttons (Fixed at bottom of modal) */}
        <div className="p-4 bg-zinc-900 border-t border-white/5 flex gap-3">
           <Button className="flex-1" variant="outline" onClick={onClose}>
             关闭
           </Button>
           <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleDownload} disabled={isGenerating}>
             {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
             保存海报
           </Button>
        </div>
      </div>
    </div>
  )
}

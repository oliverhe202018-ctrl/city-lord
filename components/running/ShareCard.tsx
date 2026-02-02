'use client'

import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'

interface ShareCardProps {
  id?: string // For capture identification
  runPath: [number, number][] // [lat, lng] array
  distanceKm: number
  date?: string
  userId: string
  userName?: string
  className?: string
}

export function ShareCard({ 
  id = 'share-card',
  runPath, 
  distanceKm, 
  date = new Date().toLocaleDateString(), 
  userId,
  userName = 'City Lord',
  className 
}: ShareCardProps) {
  // Normalize Path Logic
  // 1. Find bounding box
  const lats = runPath.map(p => p[0])
  const lngs = runPath.map(p => p[1])
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  // 2. Scale to viewBox 300x300 with padding
  const padding = 20
  const size = 300
  const drawSize = size - padding * 2

  // Edge case: single point or flat line
  const latRange = maxLat - minLat || 0.000001
  const lngRange = maxLng - minLng || 0.000001
  
  // Preserve aspect ratio
  // If one dimension is much larger, scale based on the larger one to fit inside box
  const scale = Math.min(drawSize / latRange, drawSize / lngRange)

  // Center the path if it's not filling the box (e.g. very thin)
  const xOffset = (drawSize - lngRange * scale) / 2
  const yOffset = (drawSize - latRange * scale) / 2

  // 3. Generate SVG Path Data
  // Note: SVG Y coordinates go down, Latitude goes up. We need to invert Lat.
  const pathData = runPath.map((p, i) => {
    // Normalize to 0-1 range first, then scale
    const normalizedLat = (p[0] - minLat) / latRange // 0 to 1
    const normalizedLng = (p[1] - minLng) / lngRange // 0 to 1

    // Map to pixel coordinates
    // Y: Invert (1 - normalizedLat)
    const y = padding + yOffset + (1 - normalizedLat) * (latRange * scale)
    const x = padding + xOffset + normalizedLng * (lngRange * scale)
    
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  const referralUrl = `https://myapp.com?ref=${userId}`

  return (
    <div 
      id={id}
      className={cn(
        "relative w-[375px] h-[500px] bg-slate-950 overflow-hidden flex flex-col items-center justify-between p-6 shadow-2xl",
        className
      )}
      style={{
        background: 'radial-gradient(circle at 50% 10%, #1e1b4b 0%, #020617 100%)'
      }}
    >
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <div className="absolute top-0 left-0 w-full h-full bg-[url('/grid-pattern.svg')] opacity-30" />
         <div className="absolute -top-20 -right-20 w-60 h-60 bg-purple-500 rounded-full blur-[100px]" />
         <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-cyan-500 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="z-10 w-full flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 tracking-tighter">
            城市领主
          </h2>
          <p className="text-slate-400 text-xs font-mono mt-1">地盘争夺记录</p>
        </div>
        <div className="text-right">
          <p className="text-white font-bold">{userName}</p>
          <p className="text-slate-500 text-xs">{date}</p>
        </div>
      </div>

      {/* The Track Visual */}
      <div className="z-10 relative w-[300px] h-[300px] flex items-center justify-center">
        <svg 
          width="300" 
          height="300" 
          viewBox="0 0 300 300" 
          className="drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]"
        >
          {/* Path Glow */}
          <path 
            d={pathData} 
            fill="none" 
            stroke="#22d3ee" 
            strokeWidth="4" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className="animate-draw"
          />
          {/* Start Point */}
          {runPath.length > 0 && (
             <circle 
               cx={padding + (runPath[0][1] - minLng) * scale} 
               cy={size - (padding + (runPath[0][0] - minLat) * scale)} 
               r="4" 
               fill="#fff" 
             />
          )}
          {/* End Point */}
          {runPath.length > 0 && (
             <circle 
               cx={padding + (runPath[runPath.length-1][1] - minLng) * scale} 
               cy={size - (padding + (runPath[runPath.length-1][0] - minLat) * scale)} 
               r="4" 
               fill="#ef4444" 
             />
          )}
        </svg>

        {/* Stats Overlay on Map */}
        <div className="absolute bottom-4 left-4">
           <span className="text-4xl font-black text-white italic tracking-tighter drop-shadow-lg">
             {distanceKm.toFixed(2)}
           </span>
           <span className="text-cyan-400 font-bold ml-1">KM</span>
        </div>
      </div>

      {/* Footer / QR */}
      <div className="z-10 w-full flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
        <div className="bg-white p-1 rounded-lg">
          <QRCodeSVG 
            value={referralUrl} 
            size={64} 
            level="M"
            fgColor="#000000"
            bgColor="#ffffff"
          />
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm leading-tight">
            加入地盘争夺
          </p>
          <p className="text-slate-400 text-xs mt-1">
            扫码领取新手礼包并加入我的阵营。
          </p>
        </div>
      </div>
    </div>
  )
}

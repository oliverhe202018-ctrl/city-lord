"use client"

import { Drawer } from "vaul"
import { Navigation, Shield, Sword, AlertTriangle, Cloud } from "lucide-react"
import { useState } from "react"

export interface HexCellData {
  hexId: string
  status: "owned" | "enemy" | "neutral" | "contested" | "fog"
  coordinates: number[][] // [lng, lat][]
  level?: number
  ownerName?: string
  ownerId?: string // For deterministic coloring
  faction?: 'RED' | 'BLUE' | null // For faction mode
  lastActivity?: string
}

interface HexDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  cell: HexCellData | null
  onNavigate: (cell: HexCellData) => void
  onAction: (cell: HexCellData) => void
}

export function HexDetailSheet({ isOpen, onClose, cell, onNavigate, onAction }: HexDetailSheetProps) {
  if (!cell) return null

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "owned":
        return { label: "我方领地", color: "text-green-400", bg: "bg-green-500/20", icon: Shield }
      case "enemy":
        return { label: "敌方领地", color: "text-red-400", bg: "bg-red-500/20", icon: Sword }
      case "contested":
        return { label: "争夺中", color: "text-orange-400", bg: "bg-orange-500/20", icon: AlertTriangle }
      case "fog":
        return { label: "未探索", color: "text-slate-400", bg: "bg-slate-500/20", icon: Cloud }
      default:
        return { label: "中立区域", color: "text-blue-400", bg: "bg-blue-500/20", icon: Shield }
    }
  }

  const info = getStatusInfo(cell.status)
  const StatusIcon = info.icon

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()} snapPoints={[0.4, 0.8]}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200]" />
        <Drawer.Content className="bg-slate-900 border-t border-white/10 flex flex-col rounded-t-[20px] fixed bottom-0 left-0 right-0 z-[201] outline-none h-full max-h-[80vh]">
          {/* Handle */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-white/20 mt-4" />
          
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-lg ${info.bg}`}>
                    <StatusIcon className={`w-4 h-4 ${info.color}`} />
                  </div>
                  <h2 className="text-xl font-bold text-white">{info.label}</h2>
                </div>
                <p className="text-sm text-white/50 font-mono">{cell.hexId}</p>
              </div>
              {cell.level && (
                <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <span className="text-xs font-medium text-white">Lv.{cell.level}</span>
                </div>
              )}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-white/40 block mb-1">归属者</span>
                <span className="text-sm font-medium text-white">{cell.ownerName || "暂无"}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs text-white/40 block mb-1">最近活动</span>
                <span className="text-sm font-medium text-white">{cell.lastActivity || "无记录"}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-auto">
              <button
                onClick={() => onNavigate(cell)}
                className="flex-1 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <Navigation className="w-4 h-4" />
                导航前往
              </button>
              <button
                onClick={() => onAction(cell)}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform
                  ${cell.status === 'owned' 
                    ? 'bg-green-500/20 border border-green-500/50 text-green-400' 
                    : 'bg-red-500/20 border border-red-500/50 text-red-400'
                  }`}
              >
                {cell.status === 'owned' ? <Shield className="w-4 h-4" /> : <Sword className="w-4 h-4" />}
                {cell.status === 'owned' ? '驻守领地' : '发起进攻'}
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

"use client"

import { useState, useEffect } from "react"
import { X, Swords, MapPin, Clock, Zap, Shield, ChevronRight } from "lucide-react"

interface TerritoryAlertProps {
  isOpen: boolean
  onClose: () => void
  attacker: {
    name: string
    avatar?: string
    level: number
    clan?: string
  }
  territory: {
    id: string
    name: string
    coordinates: string
  }
  timeAgo: string
  onCounterAttack?: () => void
  onViewMap?: () => void
}

export function TerritoryAlert({
  isOpen,
  onClose,
  attacker,
  territory,
  timeAgo,
  onCounterAttack,
  onViewMap,
}: TerritoryAlertProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      setIsExiting(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsAnimating(false)
      onClose()
    }, 300)
  }

  if (!isOpen && !isAnimating) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
      />

      {/* Alert Card */}
      <div
        className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-b from-red-950/90 to-black/95 shadow-2xl shadow-red-500/20 backdrop-blur-xl transition-all duration-300 ${
          isExiting
            ? "scale-95 opacity-0 translate-y-4"
            : "scale-100 opacity-100 translate-y-0"
        }`}
      >
        {/* Animated border glow */}
        <div className="absolute inset-0 animate-pulse rounded-3xl bg-gradient-to-r from-red-500/20 via-transparent to-red-500/20" />
        
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/60 transition-all hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Alert icon with pulse animation */}
        <div className="relative flex justify-center pt-8">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-500/30" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500/50 bg-red-500/20">
              <Swords className="h-10 w-10 text-red-500" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="relative p-6 pt-4">
          <h2 className="text-center text-xl font-bold text-red-400">
            领地被占领!
          </h2>
          <p className="mt-1 text-center text-sm text-white/60">
            你的领地遭到攻击
          </p>

          {/* Territory info */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <MapPin className="h-4 w-4" />
              <span>{territory.name}</span>
              <span className="text-white/30">|</span>
              <span className="font-mono text-xs">{territory.coordinates}</span>
            </div>
          </div>

          {/* Attacker info */}
          <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-red-400/70">
              入侵者
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-lg font-bold text-red-400">
                {attacker.avatar || attacker.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{attacker.name}</span>
                  {attacker.clan && (
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs font-medium text-red-400">
                      [{attacker.clan}]
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/50">等级 {attacker.level}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-white/40">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 space-y-3">
            <button
              onClick={() => {
                onCounterAttack?.()
                handleClose()
              }}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 py-4 font-semibold text-white shadow-lg shadow-red-500/30 transition-all hover:from-red-500 hover:to-red-400 active:scale-[0.98]"
            >
              <Zap className="h-5 w-5 transition-transform group-hover:scale-110" />
              立即反击
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            
            <button
              onClick={() => {
                onViewMap?.()
                handleClose()
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <Shield className="h-4 w-4" />
              查看地图
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Demo wrapper for showcase */
export function TerritoryAlertDemo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-xl bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/30"
      >
        模拟领地被抢占
      </button>
      <TerritoryAlert
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        attacker={{
          name: "NightHunter",
          level: 12,
          clan: "暗影军团",
        }}
        territory={{
          id: "hex-123",
          name: "中央广场",
          coordinates: "H7-K3",
        }}
        timeAgo="2分钟前"
      />
    </div>
  )
}

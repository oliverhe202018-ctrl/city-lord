"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Pause, Play, Square, ChevronUp, MapPin, Zap, Heart, Hexagon, Trophy } from "lucide-react"
import { hexCountToArea, formatArea, HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"
import { claimTerritory, fetchTerritories } from "@/app/actions/city"
import { latLngToCell } from "h3-js"
import { useCity } from "@/contexts/CityContext"
import { toast } from "sonner"
import { AchievementPopup } from "../achievement-popup"
import { RunningHUD } from "@/components/running/RunningHUD"
import { GaodeMap3D } from "@/components/map/GaodeMap3D"

interface ImmersiveModeProps {
  isActive: boolean
  distance: number // in km
  pace: string // e.g., "6:42"
  time: string // e.g., "00:12:34"
  calories: number
  heartRate?: number
  hexesCaptured: number
  currentHexProgress: number // 0-100
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onExpand: () => void
  currentLocation?: { lat: number; lng: number }
}

export function ImmersiveRunningMode({
  isActive,
  distance,
  pace,
  time,
  calories,
  heartRate,
  hexesCaptured,
  currentHexProgress,
  onPause,
  onResume,
  onStop,
  onExpand,
  currentLocation,
}: ImmersiveModeProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [displayedArea, setDisplayedArea] = useState(0)
  const [areaFlash, setAreaFlash] = useState(false)
  const { currentCity } = useCity() // Removed refreshTerritories as it's not in context
  const [lastClaimedHex, setLastClaimedHex] = useState<string | null>(null)
  
  // Map Data State
  const [mapHexagons, setMapHexagons] = useState<string[]>([])
  const [exploredHexes, setExploredHexes] = useState<string[]>([])

  // Load territories for map
  const loadTerritories = useCallback(async () => {
    if (!currentCity) return
    try {
      const territories = await fetchTerritories(currentCity.id)
      setMapHexagons(territories.map(t => t.id))
      setExploredHexes(territories.filter(t => t.ownerType === 'me').map(t => t.id))
    } catch (e: any) {
      if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
        console.error("Failed to load territories", e)
      }
    }
  }, [currentCity])

  // Initial load
  useEffect(() => {
    loadTerritories()
  }, [loadTerritories])

  // Calculate total captured area
  const totalCapturedArea = hexCountToArea(hexesCaptured)
  const currentPartialArea = Math.round((currentHexProgress / 100) * HEX_AREA_SQ_METERS)
  const totalArea = totalCapturedArea + currentPartialArea
  const formattedArea = formatArea(totalArea)

  // Territory Capture Logic
  const isClaimingRef = useRef(false)

  useEffect(() => {
    if (!isActive || isPaused || !currentLocation || !currentCity) return

    const checkAndClaimTerritory = async () => {
      try {
        // Calculate H3 index (resolution 9 is standard for gameplay)
        const h3Index = latLngToCell(currentLocation.lat, currentLocation.lng, 9)
        
        // Prevent spamming the same hex or if currently claiming
        if (h3Index === lastClaimedHex || isClaimingRef.current) return

        isClaimingRef.current = true

        // Call server action
        const result = await claimTerritory(currentCity.id, h3Index)
        
        if (result.success) {
          setLastClaimedHex(h3Index)
          toast.success("占领成功!", {
            description: "获得 +50 XP",
            icon: <Hexagon className="h-4 w-4 text-[#22c55e]" />,
          })

          // Show badge notifications
          if (result.grantedBadges && result.grantedBadges.length > 0) {
            result.grantedBadges.forEach(badgeName => {
              toast.success(`解锁勋章: ${badgeName}`, {
                icon: <Trophy className="h-4 w-4 text-yellow-400" />,
                style: { 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  color: 'white', 
                  border: '1px solid rgba(250, 204, 21, 0.5)' 
                }
              })
            })
          }

          // Refresh map overlay
          loadTerritories()
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError' && error?.digest !== 'NEXT_REDIRECT') {
          console.error("Auto-claim failed:", error)
        }
      } finally {
        isClaimingRef.current = false
      }
    }

    // Check every 10 seconds or when location updates significantly
    // For simplicity, we just run this effect when currentLocation changes
    // Debounce could be added if location updates are very frequent
    checkAndClaimTerritory()
    
  }, [isActive, isPaused, currentLocation, currentCity, lastClaimedHex, loadTerritories])
  
  // Animate area counter with jumping effect
  useEffect(() => {
    if (!isActive || isPaused) return

    const targetArea = totalArea
    if (displayedArea < targetArea) {
      const diff = targetArea - displayedArea
      const increment = Math.max(1, Math.ceil(diff / 10))
      const timer = setTimeout(() => {
        setDisplayedArea(prev => Math.min(prev + increment, targetArea))
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isActive, isPaused, totalArea])
  
  // Flash effect when capturing new hex
  useEffect(() => {
    if (hexesCaptured > 0) {
      setAreaFlash(true)
      const timer = setTimeout(() => setAreaFlash(false), 500)
      return () => clearTimeout(timer)
    }
  }, [hexesCaptured])

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      setIsPaused(false)
      onResume()
    } else {
      setIsPaused(true)
      onPause()
    }
  }, [isPaused, onPause, onResume])

  const handleStop = useCallback(() => {
    if (!showStopConfirm) {
      setShowStopConfirm(true)
      return
    }
    onStop()
    setShowStopConfirm(false)
  }, [showStopConfirm, onStop])

  // Reset stop confirm after 3s
  useEffect(() => {
    if (showStopConfirm) {
      const timer = setTimeout(() => setShowStopConfirm(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showStopConfirm])

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col bg-black/60 backdrop-blur-sm">
      {/* Map Background Layer */}
      <div className="absolute inset-0 z-0">
        {currentLocation && (
          <GaodeMap3D 
            hexagons={mapHexagons} 
            exploredHexes={exploredHexes} 
            userLocation={[currentLocation.lng, currentLocation.lat]} 
          />
        )}
        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
      </div>

      {/* Safe Area Top */}
      <div className="relative z-10 h-[env(safe-area-inset-top)] bg-transparent" />

      {/* New HUD Implementation */}
      <RunningHUD 
        distance={distance}
        pace={pace}
        duration={time}
        calories={calories}
        hexesCaptured={hexesCaptured}
        isPaused={isPaused}
        onPauseToggle={() => {
          if (isPaused) {
            setIsPaused(false)
            onResume()
          } else {
            setIsPaused(true)
            onPause()
          }
        }}
        onStop={() => {
          if (!showStopConfirm) {
            setShowStopConfirm(true)
            // Show toast instruction
            toast.info("再次点击确认结束", { position: "bottom-center" })
          } else {
            onStop()
          }
        }}
      />
    </div>
  )
}

// Mini FAB for triggering immersive mode from map
export function RunningFAB({
  isRunning,
  onStartRun,
  onViewRunning,
  className = "",
}: {
  isRunning: boolean
  onStartRun: () => void
  onViewRunning: () => void
  className?: string
}) {
  return (
    <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] left-1/2 z-30 -translate-x-1/2 ${className}`}>
      {isRunning ? (
        // Running state - compact view
        <button
          onClick={onViewRunning}
          className="group flex items-center gap-3 rounded-full border-2 border-[#22c55e] bg-black/80 py-2 pl-4 pr-5 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_30px_rgba(34,197,94,0.3)] backdrop-blur-xl transition-all active:scale-95"
        >
          {/* Animated pulse dot */}
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#22c55e]" />
          </span>
          <span className="text-sm font-medium text-white">跑步中...</span>
          <span className="font-mono text-sm font-bold text-[#22c55e]">点击查看</span>
        </button>
      ) : (
        // Idle state - Start Run FAB
        <button
          onClick={onStartRun}
          className="group relative flex h-[72px] w-[72px] items-center justify-center"
        >
          {/* Pulsing rings */}
          <span
            className="absolute h-full w-full animate-ping rounded-full bg-[#22c55e]/30"
            style={{ animationDuration: "2s" }}
          />
          <span
            className="absolute h-[120%] w-[120%] animate-ping rounded-full bg-[#22c55e]/15"
            style={{ animationDuration: "2s", animationDelay: "0.5s" }}
          />

          {/* Main button */}
          <span className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-[#22c55e] bg-gradient-to-br from-[#22c55e]/30 to-[#22c55e]/10 shadow-[0_4px_20px_rgba(0,0,0,0.4),0_0_30px_rgba(34,197,94,0.4)] backdrop-blur-sm transition-all group-hover:scale-105 group-hover:shadow-[0_4px_25px_rgba(0,0,0,0.5),0_0_40px_rgba(34,197,94,0.5)] group-active:scale-95">
            <span className="text-center text-sm font-bold leading-tight text-[#22c55e]">
              开始
              <br />
              跑步
            </span>
          </span>
        </button>
      )}
    </div>
  )
}

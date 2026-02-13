"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Pause, Play, Square, ChevronUp, MapPin, Zap, Heart, Hexagon, Trophy } from "lucide-react"
import { hexCountToArea, formatArea, HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"
import { claimTerritory, fetchTerritories } from "@/app/actions/city"
import { latLngToCell } from "h3-js"
import { useCity } from "@/contexts/CityContext"
import { useGameLocation } from "@/store/useGameStore"
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { toast } from "sonner"
import { AchievementPopup } from "../achievement-popup"
import { RunningHUD } from "@/components/running/RunningHUD"
import { GaodeMap3D } from "@/components/map/GaodeMap3D"
import { RunSummaryView } from "@/components/running/RunSummaryView"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Location } from "@/hooks/useRunningTracker"

import { GhostJoystick } from "./GhostJoystick"

interface ImmersiveModeProps {
  isActive: boolean
  userId?: string
  distance?: number
  pace?: number
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
  path?: Location[]
  closedPolygons?: Location[][]
  onHexClaimed?: () => void
  onManualLocation?: (lat: number, lng: number) => void
}

// Helper: Calculate distance between two points in meters
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

import { playAudio } from "@/utils/audio"

import { RunningMapOverlay } from "./RunningMapOverlay"

export function ImmersiveRunningMode({
  isActive,
  userId,
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
  path = [],
  closedPolygons = [],
  onHexClaimed,
  onManualLocation,
}: ImmersiveModeProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [isGhostMode, setIsGhostMode] = useState(false)
  const [isMapMode, setIsMapMode] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [displayedArea, setDisplayedArea] = useState(0)
  const [areaFlash, setAreaFlash] = useState(false)
  const [showLoopWarning, setShowLoopWarning] = useState(false)
  const [effectiveHexes, setEffectiveHexes] = useState(0)
  
  const { currentCity } = useCity() // Removed refreshTerritories as it's not in context
  const { ghostPath } = useGameLocation()
  const [lastClaimedHex, setLastClaimedHex] = useState<string | null>(null)
  const [currentHex, setCurrentHex] = useState<string | null>(null)

  // Haptic Feedback Logic
  useEffect(() => {
    if (!currentLocation || !currentCity?.territories || !userId) return
    
    const hex = latLngToCell(currentLocation.lat, currentLocation.lng, 9)
    if (hex !== currentHex) {
      setCurrentHex(hex)
      
      const territory = currentCity.territories.find(t => t.id === hex)
      if (territory) {
        if (territory.ownerId === userId) {
           Haptics.impact({ style: ImpactStyle.Light })
           toast.success("这是朕的江山", { duration: 2000 })
        } else if (territory.ownerId && territory.ownerId !== userId) {
           Haptics.vibrate()
           toast.warning("入侵敌方领地！", { duration: 3000 })
        }
      }
    }
  }, [currentLocation, currentHex, userId, currentCity])
  
  // Map Data State
  const [mapHexagons, setMapHexagons] = useState<string[]>([])
  const [exploredHexes, setExploredHexes] = useState<string[]>([])

  // Load territories for map
  const loadTerritories = useCallback(async () => {
    if (!currentCity) return
    try {
      const territories = await fetchTerritories(currentCity.id)
      if (territories && Array.isArray(territories)) {
        setMapHexagons(territories.map(t => t.id))
        setExploredHexes(territories.filter(t => t.ownerType === 'me').map(t => t.id))
      }
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

  // Auto-pause if location is not updating or speed is too low?
  // For now, rely on parent component props.

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
          
          // Notify parent
          onHexClaimed?.()
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

  const handleGhostMove = useCallback((vector: {x: number, y: number}) => {
    if (!currentLocation || !onManualLocation) return
    
    // Max speed 15km/h ~= 4.16 m/s
    // Update rate 50ms => 0.05s
    // Max dist per update = 4.16 * 0.05 = 0.208 meters
    
    const speedMps = 15 / 3.6 // ~4.16
    const timeStep = 0.05 // 50ms
    const dist = speedMps * timeStep
    
    // North/South distance (dLat)
    // 1 degree lat ~= 111,320 meters
    // Joystick Y+ is down (South), so Lat decreases.
    const dLat = -(dist * vector.y) / 111320
    
    // East/West distance (dLng)
    // 1 degree lng ~= 111320 * cos(lat)
    const latRad = currentLocation.lat * (Math.PI / 180)
    const dLng = (dist * vector.x) / (111320 * Math.cos(latRad))
    
    onManualLocation(currentLocation.lat + dLat, currentLocation.lng + dLng)
  }, [currentLocation, onManualLocation])

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      setIsPaused(false)
      // Force Play Resume
      console.log('Attempting to play: run_resume.mp3');
      const audio = new Audio('/sounds/run_resume.mp3')
      audio.play().catch(e => console.error(e))
      onResume()
    } else {
      setIsPaused(true)
      // Note: Pause sound is now handled in SlideToPause component for direct feedback
      // But we keep it here for fallback/other pause triggers
      // console.log('Attempting to play: run_pause.mp3');
      // const audio = new Audio('/sounds/run_pause.mp3')
      // audio.play().catch(e => console.error(e))
      onPause()
    }
  }, [isPaused, onPause, onResume])

  // const handleStop = useCallback(() => {
  //   // Logic moved to handleAttemptStop
  // }, [])

  const handleAttemptStop = () => {
    // If no path data or very short path, just proceed
    const safePath = path || [];
    if (safePath.length < 2) {
      setEffectiveHexes(hexesCaptured)
      setShowSummary(true)
      return
    }

    const startPoint = safePath[0]
    const endPoint = safePath[safePath.length - 1]
    
    // Calculate gap between start and end
    const gap = getDistanceFromLatLonInMeters(
        startPoint.lat, startPoint.lng,
        endPoint.lat, endPoint.lng
    )

    const LOOP_THRESHOLD = 50 // meters

    if (gap <= LOOP_THRESHOLD) {
        // Closed loop
        setEffectiveHexes(hexesCaptured)
        // 1. Audio logic moved to handleStop (final confirm)
        setShowSummary(true)
    } else {
        // Open loop - Warn user
        setShowLoopWarning(true)
    }
  }

  // Reset stop confirm after 3s
  useEffect(() => {
    if (showStopConfirm) {
      const timer = setTimeout(() => setShowStopConfirm(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showStopConfirm])

  const handleStop = (e?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // 1. 尝试播放音频 (放在 try-catch 中，绝不阻塞)
    try {
        const audio = new Audio('/sounds/run_finish.mp3');
        (window as any).finishAudio = audio; // Critical: Keep alive
        audio.play().catch(e => console.log('Audio error handled:', e));
    } catch (err) {
        console.log('Audio init error:', err);
    }
    
    // 2. 强制执行结束逻辑 (放在 setTimeout 中确保跳出当前事件循环)
    setTimeout(() => {
      onStop(); 
    }, 100);
  };

  if (showSummary) {
    return (
      <RunSummaryView 
        distance={distance}
        duration={time}
        pace={pace}
        calories={calories}
        hexesCaptured={effectiveHexes}
        onClose={handleStop}
        onShare={() => {
          toast.success("分享图片已生成 (模拟)")
        }}
      />
    )
  }

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col bg-black/60 backdrop-blur-sm">
      {/* Loop Warning Dialog */}
      <AlertDialog open={showLoopWarning} onOpenChange={setShowLoopWarning}>
        <AlertDialogContent className="w-[90%] rounded-xl bg-[#1a1a1a] text-white border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-center">未形成闭环</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60 text-center text-base">
              当前跑步路径未回到起点附近，无法形成有效领地闭环。
              <br/><br/>
              如果现在结束，<span className="text-red-400 font-bold">将不会计算</span>本次圈地面积。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-0 mt-4">
            <AlertDialogCancel 
              className="flex-1 bg-white/10 border-0 text-white hover:bg-white/20 h-12 rounded-full"
              onClick={() => setShowLoopWarning(false)}
            >
              继续跑步
            </AlertDialogCancel>
            <AlertDialogAction 
              className="flex-1 bg-red-500 text-white hover:bg-red-600 h-12 rounded-full border-0"
              onClick={() => {
                setShowLoopWarning(false)
                setEffectiveHexes(0)
                // Audio logic handled in handleStop (via onClose) or explicit here if we call handleStop?
                // Actually, handleStop is called by RunSummaryView onClose.
                // But if we skip summary and stop immediately... 
                // Wait, logic says: setShowSummary(true). So summary opens.
                // Then user clicks "Finish" in Summary -> handleStop -> Audio + onStop.
                // So we DON'T need audio here.
                
                setShowSummary(true)
              }}
            >
              确认结束
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Map Background Layer */}
      <div className="absolute inset-0 z-0">
        {currentLocation && (
          <GaodeMap3D 
            hexagons={mapHexagons} 
            exploredHexes={exploredHexes} 
            userLocation={[currentLocation.lng, currentLocation.lat]} 
            path={path}
            ghostPath={ghostPath?.map(p => ({ lat: p[0], lng: p[1] } as Location)) || []}
            closedPolygons={closedPolygons}
          />
        )}
        {/* Gradient Overlay for text readability - Hide in Map Mode */}
        {!isMapMode && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
        )}
      </div>

      {/* Safe Area Top - Hide in Map Mode as Overlay handles it */}
      {!isMapMode && <div className="relative z-10 h-[env(safe-area-inset-top)] bg-transparent" />}

      {/* New HUD Implementation */}
      <div className={isMapMode ? "opacity-0 pointer-events-none transition-opacity duration-300" : "opacity-100 transition-opacity duration-300"}>
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
          onStop={handleAttemptStop}
          onGhostModeTrigger={() => {
             setIsGhostMode(true)
             toast.success("幽灵模式已开启", {
               description: "使用右下角摇杆控制移动",
               icon: <Zap className="h-4 w-4 text-purple-400" />
             })
          }}
          // Pass map toggle handler to HUD
          onMapClick={() => setIsMapMode(true)}
        />
      </div>

      {/* Map Overlay Mode (New Design) */}
      {isMapMode && (
        <RunningMapOverlay 
          distance={distance || 0}
          duration={time}
          pace={pace ? String(pace) : "00:00"} // Assuming pace is number or string, check props
          area={currentPartialArea} // Or totalArea?
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          onBack={() => setIsMapMode(false)}
        />
      )}
      
      {isGhostMode && <GhostJoystick onMove={handleGhostMove} />}
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

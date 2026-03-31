"use client"

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { Pause, Play, Square, ChevronUp, MapPin, Zap, Heart, Hexagon, Trophy } from "lucide-react"
import { hexCountToArea, formatArea, HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"
// import { claimTerritory, fetchTerritories } from "@/app/actions/city"
import { useCity } from "@/contexts/CityContext"
import { useGameLocation } from "@/store/useGameStore"
import { safeHapticImpact, safeHapticVibrate } from "@/lib/capacitor/safe-plugins"
import { toast } from "sonner"
import { AchievementPopup } from "../achievement-popup"
import { RunningHUD } from "@/components/running/RunningHUD"
import dynamic from "next/dynamic"
import { RunningMapOverlay } from "./RunningMapOverlay"
import { AnimatePresence, motion } from "framer-motion"

const RunningMap = dynamic(() => import("./RunningMap").then(mod => mod.RunningMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-900 border border-white/5 flex items-center justify-center text-white/50 font-medium">正在加载地图...</div>
})
import { GhostJoystick } from "./GhostJoystick"
import { RunSummaryView } from "@/components/running/RunSummaryView"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { Location } from "@/hooks/useRunningTracker"
import { useBattleCaster } from "@/hooks/useBattleCaster"
import { useGameStore } from "@/store/useGameStore"
import { ActiveRandomEvent } from "@/hooks/useRandomEvents"
import { RunEventLog } from "@/types/run-sync"

// ─── Timeout utility for promises that may hang after sleep ───
const SAVE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('SAVE_TIMEOUT')), ms)
    ),
  ]);
}

interface ImmersiveModeProps {
  isActive: boolean
  useSharedMapBase?: boolean
  userId?: string
  // Raw data (preferred for calculations)
  distanceMeters?: number // meters
  durationSeconds?: number // seconds
  steps?: number // estimated steps
  area?: number // m² total claimed area
  // Legacy formatted values (for display)
  distance?: number // km (legacy)
  pace?: number | string
  time: string // e.g., "00:12:34"
  calories: number
  heartRate?: number
  hexesCaptured: number
  currentHexProgress: number // 0-100
  /** Sync pause state from tracker to prevent desync on remount */
  initialIsPaused?: boolean
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onExpand: () => void
  currentLocation?: { lat: number; lng: number }
  path?: Location[]
  closedPolygons?: Location[][]
  onHexClaimed?: () => void
  onManualLocation?: (lat: number, lng: number) => void
  saveRun?: (isFinal?: boolean) => Promise<void>
  savedRunId?: string | null
  runNumber?: number
  damageSummary?: any[]
  maintenanceSummary?: any[]
  settledTerritoriesCount?: number
  runIsValid?: boolean
  antiCheatLog?: string | null
  idempotencyKey?: string
  eventsHistory?: RunEventLog[]
  activeRandomEvent?: ActiveRandomEvent | null
  randomEventCountdownSeconds?: number
}

const springTransition = { type: "spring", stiffness: 300, damping: 30 } as const

type MotionVariantType = "hudTop" | "hudBottom" | "eventCard" | "banner"

function MotionWrapper({
  variant,
  children,
  className
}: {
  variant: MotionVariantType
  children: ReactNode
  className?: string
}) {
  if (variant === "hudTop") {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={springTransition}
      >
        {children}
      </motion.div>
    )
  }

  if (variant === "eventCard") {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, scale: 0.8, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: -18 }}
        transition={springTransition}
      >
        {children}
      </motion.div>
    )
  }

  if (variant === "banner") {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0, y: -22 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -26 }}
        transition={springTransition}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={springTransition}
    >
      {children}
    </motion.div>
  )
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

export function ImmersiveRunningMode({
  isActive,
  useSharedMapBase = false,
  userId,
  distanceMeters = 0,
  durationSeconds = 0,
  steps = 0,
  area = 0,
  distance,
  pace,
  time,
  calories,
  heartRate,
  hexesCaptured,
  currentHexProgress,
  initialIsPaused = false,
  onPause,
  onResume,
  onStop,
  onExpand,
  currentLocation,
  path = [],
  closedPolygons = [],
  onHexClaimed,
  onManualLocation,
  saveRun,
  savedRunId,
  runNumber,
  damageSummary,
  maintenanceSummary,
  settledTerritoriesCount,
  runIsValid,
  antiCheatLog,
  idempotencyKey,
  eventsHistory = [],
  activeRandomEvent,
  randomEventCountdownSeconds = 0
}: ImmersiveModeProps) {
  const [isPaused, setIsPaused] = useState(initialIsPaused)

  // Sync tracker's isPaused into local state whenever the external source changes.
  // This prevents desync if the component remounts while the tracker is already paused.
  useEffect(() => {
    setIsPaused(initialIsPaused);
  }, [initialIsPaused]);
  const [isGhostMode, setIsGhostMode] = useState(false)
  const [isMapMode, setIsMapMode] = useState(false) // Default back to HUD mode as requested
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [displayedArea, setDisplayedArea] = useState(0)
  const [areaFlash, setAreaFlash] = useState(false)
  const [showLoopWarning, setShowLoopWarning] = useState(false)
  const [effectiveHexes, setEffectiveHexes] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Local kingdom toggle — independent of MapRoot context (avoids useMap crash)
  const [showKingdom, setShowKingdom] = useState(false)
  const [floatingBanner, setFloatingBanner] = useState<{ id: number; text: string; tone: "capture" | "shield" } | null>(null)
  const [showEventResolveFx, setShowEventResolveFx] = useState(false)
  // Debounce ref for stop button
  const lastStopAttemptRef = useRef(0)
  const bannerTimerRef = useRef<number | null>(null)
  const prevHexesCapturedRef = useRef(hexesCaptured)
  const prevSuccessfulEventsRef = useRef(0)

  const { currentCity } = useCity()
  const { ghostPath } = useGameLocation()
  const [lastClaimedHex, setLastClaimedHex] = useState<string | null>(null)
  const [currentHex, setCurrentHex] = useState<string | null>(null)
  const faction = useGameStore(s => s.faction)

  // ─── Module 1: Battle Caster (Native TTS) ───
  useBattleCaster({
    distanceMeters,
    hexesCaptured,
    pace: typeof pace === 'number' ? `${Math.floor(pace)}'${Math.round((pace % 1) * 60)}"` : (pace ?? '--\'--"'),
    factionName: faction
  })


  // Haptic Feedback Logic
  useEffect(() => {
    if (!currentLocation || !currentCity?.territories || !userId) return

    // 旧自动触感逻辑已关闭，避免长时间跑步时额外占用内存
  }, [currentLocation, currentCity, userId])

  // Map Data State
  const [mapHexagons, setMapHexagons] = useState<string[]>([])
  const [exploredHexes, setExploredHexes] = useState<string[]>([])

  // Load territories for map
  const loadTerritories = useCallback(async () => {
    if (!currentCity) return
    try {
      const res = await fetch(`/api/territory/list?cityId=${currentCity.id}`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to fetch')
      const territories = await res.json()

      if (territories && Array.isArray(territories)) {
        setMapHexagons(territories.map((t: any) => t.id))
        setExploredHexes(territories.filter((t: any) => t.ownerType === 'me').map((t: any) => t.id))
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
        // 自动抢占逻辑已迁移到多边形结算链路，这里只保留安全短路
        return
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
  }, [isActive, isPaused, totalArea, displayedArea])

  // Flash effect when capturing new hex
  useEffect(() => {
    if (hexesCaptured > 0) {
      setAreaFlash(true)
      const timer = setTimeout(() => setAreaFlash(false), 500)
      return () => clearTimeout(timer)
    }
  }, [hexesCaptured])

  const showTopBanner = useCallback((text: string, tone: "capture" | "shield") => {
    if (bannerTimerRef.current !== null) {
      window.clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = null
    }
    setFloatingBanner({ id: Date.now(), text, tone })
    bannerTimerRef.current = window.setTimeout(() => {
      setFloatingBanner(null)
      bannerTimerRef.current = null
    }, 2000)
  }, [])

  useEffect(() => {
    const prev = prevHexesCapturedRef.current
    if (hexesCaptured > prev && isActive) {
      showTopBanner("⚔️ 成功占领新领地！", "capture")
    }
    prevHexesCapturedRef.current = hexesCaptured
  }, [hexesCaptured, isActive, showTopBanner])

  useEffect(() => {
    const successfulEvents = eventsHistory.filter(event => event.status === 'SUCCESS')
    const prevSuccess = prevSuccessfulEventsRef.current
    if (successfulEvents.length > prevSuccess && isActive) {
      const latestSuccess = successfulEvents[successfulEvents.length - 1]
      if (latestSuccess?.eventType === 'ENERGY_SURGE') {
        showTopBanner("🛡️ 领地护盾已加固", "shield")
      }
      setShowEventResolveFx(true)
      const timer = window.setTimeout(() => setShowEventResolveFx(false), 650)
      prevSuccessfulEventsRef.current = successfulEvents.length
      return () => window.clearTimeout(timer)
    }
    prevSuccessfulEventsRef.current = successfulEvents.length
  }, [eventsHistory, isActive, showTopBanner])

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current)
      }
    }
  }, [])

  const handleGhostMove = useCallback((vector: { x: number, y: number }) => {
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
    try {
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
        // Ensure tracker is paused when showing summary to prevent timer drift
        if (!isPaused) handlePauseToggle()
        setShowSummary(true)
      } else {
        // Open loop - Warn user
        setShowLoopWarning(true)
      }
    } catch (err) {
      // Fallback: always allow user to end run even if path analysis fails
      console.error("handleAttemptStop error, falling back to summary:", err)
      setEffectiveHexes(hexesCaptured)
      setShowSummary(true)
    }
  }

  // Reset stop confirm after 3s
  useEffect(() => {
    if (showStopConfirm) {
      const timer = setTimeout(() => setShowStopConfirm(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showStopConfirm])

  const [showRetryDialog, setShowRetryDialog] = useState(false);

  const handleRetrySave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    if (saveRun) {
      try {
        await withTimeout(saveRun(true), SAVE_TIMEOUT_MS);
        localStorage.removeItem('CURRENT_RUN_RECOVERY');
        localStorage.removeItem('PENDING_RUN_UPLOAD');
        const { useGameStore } = await import('@/store/useGameStore');
        useGameStore.getState().resetRunState();
        setShowRetryDialog(false);
        onStop();
        setShowSummary(false);
      } catch (saveError) {
        const errorMsg = saveError instanceof Error ? saveError.message : '网络不可用';
        toast.error(`保存失败：${errorMsg === 'SAVE_TIMEOUT' ? '请求超时' : errorMsg}，跑步记录已安全保存在本地`, { duration: 5000 });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSafeExit = async () => {
    setShowRetryDialog(false);
    // Explicitly retain localStorage 'CURRENT_RUN_RECOVERY'
    const { useGameStore } = await import('@/store/useGameStore');
    useGameStore.getState().resetRunState(); // Reset memory state only
    onStop();
    setShowSummary(false);
  };

  const handleStop = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Debounce: reject clicks within 2 seconds of each other
    const now = Date.now();
    if (now - lastStopAttemptRef.current < 2000) return;
    lastStopAttemptRef.current = now;

    if (isSubmitting) return;
    setIsSubmitting(true);

    // 1. Play audio (non-blocking, never delays navigation)
    try {
      const audio = new Audio('/sounds/run_finish.mp3');
      (window as typeof window & { finishAudio?: HTMLAudioElement }).finishAudio = audio;
      audio.play().catch(() => { });
    } catch { }

    // Intercept short distance runs
    if (distanceMeters < 10) {
      toast.info("距离过短，记录已自动作废", { duration: 3000 });
      localStorage.removeItem('CURRENT_RUN_RECOVERY');
      
      const { useGameStore } = await import('@/store/useGameStore');
      useGameStore.getState().resetRunState();
      
      onStop();
      setShowSummary(false);
      setIsSubmitting(false);
      return;
    }

    if (saveRun) {
      try {
        // Wrap with timeout — prevents infinite hang after long sleep
        await withTimeout(saveRun(true), SAVE_TIMEOUT_MS);
        // Success — Clean up recovery key. (Do NOT blindly wipe all PENDING_RUN_UPLOADs)
        localStorage.removeItem('CURRENT_RUN_RECOVERY');
        const { useGameStore } = await import('@/store/useGameStore');
        useGameStore.getState().resetRunState();

        onStop();
        setShowSummary(false);
        // Trigger map refresh (Phase 2)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('citylord:refresh-territories'));
        }
      } catch (saveError) {
        // Persist to localStorage as offline fallback before showing retry dialog
        try {
          const fallbackData = {
            idempotencyKey: idempotencyKey || crypto.randomUUID(),
            path: path || [],
            distance: distanceMeters || 0,
            duration: durationSeconds || 0,
            area: area || 0,
            totalSteps: steps || 0,
            steps: steps || 0,
            eventsHistory,
            timestamp: Date.now(),
            userId: userId || '',
          };
          let existingPending: any[] = [];
          try {
            const existingPendingStr = localStorage.getItem('PENDING_RUN_UPLOAD');
            if (existingPendingStr) {
              existingPending = JSON.parse(existingPendingStr);
            }
          } catch (e) { /* ignore parse error from corrupt storage */ }

          if (!Array.isArray(existingPending)) {
            existingPending = [];
          }

          const existingIndex = existingPending.findIndex(p => p.idempotencyKey === fallbackData.idempotencyKey);
          if (existingIndex >= 0) {
            existingPending[existingIndex] = fallbackData;
            console.log('[ImmersiveMode] Offline fallback updated (upsert) in localStorage');
          } else {
            existingPending.push(fallbackData);
            console.log('[ImmersiveMode] Offline fallback appended to localStorage');
          }

          // CRITICAL GUARD: Only remove active recovery if pending write SUCCESSFUL
          try {
            localStorage.setItem('PENDING_RUN_UPLOAD', JSON.stringify(existingPending));

            // If the setItem above succeeded without QuotaExceededError, we can safely clear the active one
            localStorage.removeItem('CURRENT_RUN_RECOVERY');
            console.log('[ImmersiveMode] Pending saved successfully. Active recovery cleared.');
          } catch (storageErr) {
            console.error('[ImmersiveMode] Failed to save offline fallback due to storage constraints', storageErr);
            toast.error("本机存储空间已满，无法保存进度，请清理空间！", { duration: 5000 });
            // If we fail to save pending, do NOT remove CURRENT_RUN_RECOVERY.
            // Therefore, the sequence aborts here without removing it, preserving double-loss.
          }
        } catch (storageErr) {
          console.error('[ImmersiveMode] Failed to save offline fallback', storageErr);
        }

        const errorMsg = saveError instanceof Error ? saveError.message : 'Unknown error';
        if (errorMsg === 'SAVE_TIMEOUT') {
          toast.error('保存超时，已暂存本地', { duration: 5000 });
        }

        // ==========================================
        // 上传失败时本地结束 (End Locally on Upload Failure)
        // ==========================================
        // Remove recovery key so it doesn't resume on restart is ALREADY handled safely above
        // reset the tracker state
        const { useGameStore } = await import('@/store/useGameStore');
        useGameStore.getState().resetRunState();

        // Show visible retry to user
        setShowRetryDialog(true);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // No saveRun, force clear (e.g., debug mode)
      localStorage.removeItem('CURRENT_RUN_RECOVERY');
      const { useGameStore } = await import('@/store/useGameStore');
      useGameStore.getState().resetRunState();

      onStop();
      setShowSummary(false);
      setIsSubmitting(false);
    }
  };

  if (showSummary) {
    return (
      <>
        <RunSummaryView
          distanceMeters={distanceMeters}
          durationSeconds={durationSeconds}
          duration={time}
          pace={pace !== undefined ? String(pace) : '00:00'}
          calories={calories}

          capturedArea={area}
          steps={steps}
          runIsValid={runIsValid}
          antiCheatLog={antiCheatLog}
          onClose={handleStop}
          runId={savedRunId || undefined}
          runNumber={runNumber}
          damageSummary={damageSummary}
          maintenanceSummary={maintenanceSummary}
          hexesCaptured={settledTerritoriesCount !== undefined ? settledTerritoriesCount : effectiveHexes}
          runTrajectory={path}
          onShare={() => {
            toast.success("分享图片已生成 (模拟)")
          }}
        />

        {/* Save Retry Dialog — must render alongside summary so user sees it on save failure */}
        <AlertDialogPrimitive.Root open={showRetryDialog} onOpenChange={setShowRetryDialog}>
          <AlertDialogPrimitive.Portal>
            <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100001] w-[90%] max-w-[400px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-[#1a1a1a] p-6 text-white shadow-lg border border-white/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
              <div className="flex flex-col gap-2 text-center">
                <AlertDialogPrimitive.Title className="text-xl font-bold text-center text-red-400">网络异常，上传失败</AlertDialogPrimitive.Title>
                <AlertDialogPrimitive.Description className="text-white/60 text-center text-base">
                  当前网络不可用，跑步已本地结束，记录已安全保存在本地。您可以立刻重试保存，或退回首页稍后恢复。
                </AlertDialogPrimitive.Description>
              </div>
              <div className="flex flex-col gap-3 mt-6">
                <button
                  onClick={handleRetrySave}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-3.5 font-bold text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                      <span>正在重试...</span>
                    </>
                  ) : (
                    <span>立刻重试上传</span>
                  )}
                </button>
                <button
                  onClick={handleSafeExit}
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-white/10 px-4 py-3.5 font-bold text-white shadow-sm hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  稍后后台上传并退出
                </button>
              </div>
            </AlertDialogPrimitive.Content>
          </AlertDialogPrimitive.Portal>
        </AlertDialogPrimitive.Root>
      </>
    )
  }

  if (!isActive) return null

  return (
    <div
      className={useSharedMapBase ? "fixed inset-0 z-[9999] h-[100dvh] w-full flex flex-col justify-between bg-transparent" : "fixed inset-0 z-[9999] h-[100dvh] w-full flex flex-col justify-between bg-slate-900"}
    >
      {/* Loop Warning Dialog */}
      <AlertDialogPrimitive.Root open={showLoopWarning} onOpenChange={setShowLoopWarning}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100001] w-[90%] max-w-[400px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-[#1a1a1a] p-6 text-white shadow-lg border border-white/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex flex-col gap-2 text-center">
              <AlertDialogPrimitive.Title className="text-xl font-bold text-center">未形成闭环</AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-white/60 text-center text-base">
                当前跑步路径未回到起点附近，无法形成有效领地闭环。
                <br /><br />
                如果现在结束，<span className="text-red-400 font-bold">将不会计算</span>本次圈地面积。
              </AlertDialogPrimitive.Description>
            </div>
            <div className="flex flex-row gap-3 mt-6">
              <AlertDialogPrimitive.Cancel
                className="flex-1 bg-white/10 border-0 text-white hover:bg-white/20 h-12 rounded-full font-medium transition-colors"
                onClick={() => setShowLoopWarning(false)}
              >
                继续跑步
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action
                className="flex-1 bg-red-500 text-white hover:bg-red-600 h-12 rounded-full border-0 font-medium transition-colors"
                onClick={() => {
                  setShowLoopWarning(false)
                  setEffectiveHexes(0)
                  // Ensure tracker is paused when showing summary
                  if (!isPaused) handlePauseToggle()
                  setShowSummary(true)
                }}
              >
                确认结束
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>

      <AnimatePresence initial={false}>
        {floatingBanner && (
          <MotionWrapper variant="banner" className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+16px)] z-[100003] w-[min(92vw,360px)] -translate-x-1/2">
            <div className={`rounded-2xl border px-4 py-2.5 text-center text-sm font-semibold text-white shadow-2xl backdrop-blur-xl ${floatingBanner.tone === "capture" ? "border-emerald-300/45 bg-emerald-500/75" : "border-sky-300/45 bg-sky-500/75"}`}>
              {floatingBanner.text}
            </div>
          </MotionWrapper>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {activeRandomEvent && (
          <div className="pointer-events-none fixed inset-0 z-[100002] flex items-center justify-center px-6">
            <MotionWrapper variant="eventCard" className="w-full max-w-sm rounded-2xl border border-yellow-400/40 bg-black/80 p-5 text-center text-white shadow-2xl backdrop-blur">
              <div className="text-xs tracking-[0.2em] text-yellow-300">突发事件</div>
              <div className="mt-2 text-lg font-semibold">{activeRandomEvent.eventType === 'CHASE' ? '追击挑战' : '能量冲刺'}</div>
              <div className="mt-2 text-sm text-white/80">{activeRandomEvent.targetText}</div>
              <div className="mt-4 text-3xl font-bold text-yellow-300">{randomEventCountdownSeconds}s</div>
            </MotionWrapper>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {showEventResolveFx && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-[100002] flex items-center justify-center"
            initial={{ opacity: 0, y: 0, scale: 0.92 }}
            animate={{ opacity: [0, 1, 0], y: [6, -18, -30], scale: [0.92, 1, 0.96] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.62, ease: "easeOut" }}
          >
            <div className="rounded-full border border-yellow-300/45 bg-yellow-400/20 px-4 py-1.5 text-xs font-semibold tracking-wide text-yellow-100 shadow-xl backdrop-blur">
              事件结算成功
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Retry Dialog */}
      <AlertDialogPrimitive.Root open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[100000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <AlertDialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100001] w-[90%] max-w-[400px] translate-x-[-50%] translate-y-[-50%] rounded-xl bg-[#1a1a1a] p-6 text-white shadow-lg border border-white/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
            <div className="flex flex-col gap-2 text-center">
              <AlertDialogPrimitive.Title className="text-xl font-bold text-center text-red-400">网络异常，上传失败</AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-white/60 text-center text-base">
                当前网络不可用，跑步已本地结束，记录已安全保存在本地。您可以重试保存，或退回首页稍后恢复。
              </AlertDialogPrimitive.Description>
            </div>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={handleRetrySave}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-4 py-3.5 font-bold text-white shadow-lg active:scale-95 transition-transform disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                    <span>正在重试...</span>
                  </>
                ) : (
                  <span>立刻重试上传</span>
                )}
              </button>
              <button
                onClick={handleSafeExit}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-white/10 px-4 py-3.5 font-bold text-white shadow-sm hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
              >
                稍后后台上传并退出
              </button>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>

      {!useSharedMapBase && (
        <div className={`absolute inset-0 z-0 ${isPaused && !isMapMode ? 'pointer-events-none' : 'pointer-events-auto'}`}>
          <RunningMap
            userLocation={currentLocation ? [currentLocation.lng, currentLocation.lat] : undefined}
            path={path}
            onLocationUpdate={onManualLocation}
            recenterTrigger={recenterTrigger}
            showKingdom={showKingdom}
          />
          {!isMapMode && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />
          )}
        </div>
      )}

      {/* Safe Area Top - Hide in Map Mode as Overlay handles it */}
      <AnimatePresence initial={false}>
        {!isMapMode && (
          <MotionWrapper variant="hudTop">
            <div className="relative z-10 h-[env(safe-area-inset-top)] bg-transparent" />
          </MotionWrapper>
        )}
      </AnimatePresence>

      {/* New HUD Implementation */}
      <AnimatePresence initial={false}>
        {!isMapMode && (
          <MotionWrapper variant="hudBottom" className="relative z-20">
            <RunningHUD
              distance={distanceMeters / 1000}
              currentDistanceMeters={distanceMeters}
              pace={typeof pace === 'number' ? String(pace) : (pace ?? '00:00')}
              duration={time}
              calories={calories}
              steps={steps}
              hexesCaptured={hexesCaptured}
              isPaused={isPaused}
              onPause={() => {
                setIsPaused(true)
                onPause()
              }}
              onResume={() => {
                setIsPaused(false)
                onResume()
              }}
              onStop={handleAttemptStop}
              onGhostModeTrigger={() => {
                setIsGhostMode(true)
                toast.success("幽灵模式已开启", {
                  description: "使用右下角摇杆控制移动",
                  icon: <Zap className="h-4 w-4 text-purple-400" />
                })
              }}
              onToggleMap={() => {
                setIsMapMode(true)
                setRecenterTrigger(prev => prev + 1)
              }}
            />
          </MotionWrapper>
        )}
      </AnimatePresence>

      {/* Map Overlay Mode (New Design) */}
      {isMapMode && (
        <RunningMapOverlay
          distanceMeters={distanceMeters}
          duration={time}
          pace={pace ? String(pace) : "00:00"}
          area={area}
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          onStop={handleAttemptStop}
          onBack={() => setIsMapMode(false)}
          onRecenter={() => setRecenterTrigger(prev => prev + 1)}
          showKingdom={showKingdom}
          onToggleKingdom={() => setShowKingdom(v => !v)}
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

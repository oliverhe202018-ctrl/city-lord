"use client"

import { memo, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { ArrowLeft, Lock, Map, Settings2 } from "lucide-react"
import { hexCountToArea, formatArea, HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"
// import { claimTerritory, fetchTerritories } from "@/app/actions/city"
import { useCity } from "@/contexts/CityContext"
import { useGameLocation } from "@/store/useGameStore"
import { safeHapticImpact, safeHapticVibrate } from "@/lib/capacitor/safe-plugins"
import { toast } from "sonner"
import { AchievementPopup } from "../achievement-popup"
import dynamic from "next/dynamic"
import { AnimatePresence, motion } from "framer-motion"

const RunningMap = dynamic(() => import("./RunningMap").then(mod => mod.RunningMap), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-900 border border-white/5 flex items-center justify-center text-white/50 font-medium">正在加载地图...</div>
})
import { RunSummaryView } from "@/components/running/RunSummaryView"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { Location } from "@/hooks/useRunningTracker"
import { useBattleCaster } from "@/hooks/useBattleCaster"
import { useGameStore } from "@/store/useGameStore"
import { ActiveRandomEvent } from "@/hooks/useRandomEvents"
import { RunEventLog } from "@/types/run-sync"
import { LOOP_CLOSURE_THRESHOLD_M } from "@/lib/geometry-utils"

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

const DashboardActionRow = memo(function DashboardActionRow({
  onLock,
  onOpenMap,
  onToggleKingdom,
}: {
  onLock: () => void
  onOpenMap: () => void
  onToggleKingdom: () => void
}) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white active:scale-95"
        onClick={onLock}
      >
        <Lock className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="pointer-events-auto relative z-[10020] flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white active:scale-95"
        onClick={onOpenMap}
      >
        <Map className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white active:scale-95"
        onClick={onToggleKingdom}
      >
        <Settings2 className="h-5 w-5" />
      </button>
    </div>
  )
})

const RunControlButtons = memo(function RunControlButtons({
  isPaused,
  isEndPressing,
  onPauseToggle,
  onEndPressStart,
  onEndPressEnd,
  singleButtonClassName,
  pairButtonClassName,
  pairWrapperClassName,
  singleLabelClassName,
}: {
  isPaused: boolean
  isEndPressing: boolean
  onPauseToggle: () => void
  onEndPressStart: () => void
  onEndPressEnd: () => void
  singleButtonClassName: string
  pairButtonClassName: string
  pairWrapperClassName: string
  singleLabelClassName?: string
}) {
  if (!isPaused) {
    return (
      <button
        type="button"
        className={singleButtonClassName}
        onClick={onPauseToggle}
      >
        暂停跑步
      </button>
    )
  }

  return (
    <div className={pairWrapperClassName}>
      <button
        type="button"
        className={`${pairButtonClassName} ${isEndPressing ? "bg-red-700" : "bg-red-500"}`}
        onPointerDown={onEndPressStart}
        onPointerUp={onEndPressEnd}
        onPointerLeave={onEndPressEnd}
        onPointerCancel={onEndPressEnd}
      >
        {isEndPressing ? "按住以结束..." : "结束跑步"}
      </button>
      <button
        type="button"
        className={singleLabelClassName || singleButtonClassName}
        onClick={onPauseToggle}
      >
        继续跑步
      </button>
    </div>
  )
})

const MapTopBar = memo(function MapTopBar({
  onBack,
  onRecenter,
}: {
  onBack: () => void
  onRecenter: () => void
}) {
  return (
    <div className="pointer-events-auto absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+12px)] z-50 flex items-center justify-between">
      <button
        type="button"
        className="pointer-events-auto relative z-[10020] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg active:scale-95"
        onClick={onBack}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        className="rounded-full border border-white/20 bg-black/70 px-4 py-2 text-sm font-semibold text-white active:scale-95"
        onClick={onRecenter}
      >
        回到定位
      </button>
    </div>
  )
})

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

interface SummarySnapshot {
  distanceMeters: number
  durationSeconds: number
  duration: string
  pace: string
  calories: number
  capturedArea: number
  steps: number
  runIsValid?: boolean
  antiCheatLog?: string | null
  runId?: string
  runNumber?: number
  damageSummary?: any[]
  maintenanceSummary?: any[]
  hexesCaptured: number
  runTrajectory: Location[]
}

function cloneSnapshotValue<T>(value: T): T {
  if (value == null) return value
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
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
  const [isScreenLocked, setIsScreenLocked] = useState(false)
  const [viewMode, setViewMode] = useState<'dashboard' | 'map'>('map')
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [summarySnapshot, setSummarySnapshot] = useState<SummarySnapshot | null>(null)
  const [displayedArea, setDisplayedArea] = useState(0)
  const [areaFlash, setAreaFlash] = useState(false)
  const [showLoopWarning, setShowLoopWarning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Local kingdom toggle — independent of MapRoot context (avoids useMap crash)
  const [showKingdom, setShowKingdom] = useState(false)
  const [floatingBanner, setFloatingBanner] = useState<{ id: number; text: string; tone: "capture" | "shield" } | null>(null)
  const [showEventResolveFx, setShowEventResolveFx] = useState(false)
  const lastStopAttemptRef = useRef(0)
  const attemptStopRef = useRef<() => void>(() => {})
  const bannerTimerRef = useRef<number | null>(null)
  const unlockPressTimerRef = useRef<number | null>(null)
  const endPressTimerRef = useRef<number | null>(null)
  const prevHexesCapturedRef = useRef(hexesCaptured)
  const prevSuccessfulEventsRef = useRef(0)
  const [isUnlockPressing, setIsUnlockPressing] = useState(false)
  const [isEndPressing, setIsEndPressing] = useState(false)

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
      if (unlockPressTimerRef.current !== null) {
        window.clearTimeout(unlockPressTimerRef.current)
      }
      if (endPressTimerRef.current !== null) {
        window.clearTimeout(endPressTimerRef.current)
      }
    }
  }, [])

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

  const freezeTrackerForSummary = useCallback(() => {
    if (isPaused) return
    setIsPaused(true)
    onPause()
  }, [isPaused, onPause])

  const buildSummarySnapshot = useCallback((snapshotHexes: number): SummarySnapshot => {
    const safeCapturedArea = Math.max(0, Number.isFinite(area) ? area : 0)
    return {
      distanceMeters,
      durationSeconds,
      duration: time,
      pace: pace !== undefined ? String(pace) : "00:00",
      calories,
      capturedArea: safeCapturedArea,
      steps,
      runIsValid,
      antiCheatLog,
      runId: savedRunId || undefined,
      runNumber,
      damageSummary: cloneSnapshotValue(damageSummary),
      maintenanceSummary: cloneSnapshotValue(maintenanceSummary),
      hexesCaptured: settledTerritoriesCount !== undefined ? settledTerritoriesCount : snapshotHexes,
      runTrajectory: cloneSnapshotValue(path || []),
    }
  }, [distanceMeters, durationSeconds, time, pace, calories, area, steps, runIsValid, antiCheatLog, savedRunId, runNumber, damageSummary, maintenanceSummary, settledTerritoriesCount, path])

  const handleLockScreen = useCallback(() => {
    setIsScreenLocked(true)
  }, [])

  const handleUnlockPressStart = useCallback(() => {
    setIsUnlockPressing(true)
    if (unlockPressTimerRef.current !== null) {
      window.clearTimeout(unlockPressTimerRef.current)
    }
    unlockPressTimerRef.current = window.setTimeout(() => {
      setIsScreenLocked(false)
      setIsUnlockPressing(false)
      unlockPressTimerRef.current = null
    }, 1000)
  }, [])

  const handleUnlockPressEnd = useCallback(() => {
    setIsUnlockPressing(false)
    if (unlockPressTimerRef.current !== null) {
      window.clearTimeout(unlockPressTimerRef.current)
      unlockPressTimerRef.current = null
    }
  }, [])

  const handleEndPressStart = useCallback(() => {
    setIsEndPressing(true)
    if (endPressTimerRef.current !== null) {
      window.clearTimeout(endPressTimerRef.current)
    }
    endPressTimerRef.current = window.setTimeout(() => {
      setIsEndPressing(false)
      endPressTimerRef.current = null
      attemptStopRef.current()
    }, 1000)
  }, [])

  const handleEndPressEnd = useCallback(() => {
    setIsEndPressing(false)
    if (endPressTimerRef.current !== null) {
      window.clearTimeout(endPressTimerRef.current)
      endPressTimerRef.current = null
    }
  }, [])

  const handleRecenter = useCallback(() => {
    if (useSharedMapBase) {
      window.dispatchEvent(new CustomEvent('immersive-recenter-request'))
      return
    }
    setRecenterTrigger((prev) => prev + 1)
  }, [useSharedMapBase])
  const handleOpenMapView = useCallback(() => {
    setViewMode('map')
    handleRecenter()
  }, [handleRecenter])
  const handleBackToDashboard = useCallback(() => {
    setViewMode('dashboard')
  }, [])
  const handleToggleKingdom = useCallback(() => {
    setShowKingdom((v) => !v)
  }, [])
  const runningMapUserLocation = useMemo(
    () => (currentLocation ? [currentLocation.lng, currentLocation.lat] as [number, number] : undefined),
    [currentLocation]
  )

  // const handleStop = useCallback(() => {
  //   // Logic moved to handleAttemptStop
  // }, [])

  const handleAttemptStop = () => {
    try {
      // If no path data or very short path, just proceed
      const safePath = path || [];
      if (safePath.length < 2) {
        freezeTrackerForSummary()
        setSummarySnapshot(buildSummarySnapshot(hexesCaptured))
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

      const LOOP_THRESHOLD = LOOP_CLOSURE_THRESHOLD_M

      if (gap <= LOOP_THRESHOLD) {
        // Closed loop
        freezeTrackerForSummary()
        setSummarySnapshot(buildSummarySnapshot(hexesCaptured))
        setShowSummary(true)
      } else {
        // Open loop - Warn user
        setShowLoopWarning(true)
      }
    } catch (err) {
      // Fallback: always allow user to end run even if path analysis fails
      console.error("handleAttemptStop error, falling back to summary:", err)
      freezeTrackerForSummary()
      setSummarySnapshot(buildSummarySnapshot(hexesCaptured))
      setShowSummary(true)
    }
  }
  attemptStopRef.current = handleAttemptStop

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
        setSummarySnapshot(null);
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
    setSummarySnapshot(null);
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
      
      setSummarySnapshot(null);
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
        setSummarySnapshot(null);
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
      setSummarySnapshot(null);
      setShowSummary(false);
      setIsSubmitting(false);
    }
  };

  if (showSummary && summarySnapshot) {
    return (
      <>
        <RunSummaryView
          distanceMeters={summarySnapshot.distanceMeters}
          durationSeconds={summarySnapshot.durationSeconds}
          duration={summarySnapshot.duration}
          pace={summarySnapshot.pace}
          calories={summarySnapshot.calories}
          capturedArea={summarySnapshot.capturedArea}
          steps={summarySnapshot.steps}
          runIsValid={summarySnapshot.runIsValid}
          antiCheatLog={summarySnapshot.antiCheatLog}
          onClose={handleStop}
          runId={summarySnapshot.runId}
          runNumber={summarySnapshot.runNumber}
          damageSummary={summarySnapshot.damageSummary}
          maintenanceSummary={summarySnapshot.maintenanceSummary}
          hexesCaptured={summarySnapshot.hexesCaptured}
          runTrajectory={summarySnapshot.runTrajectory}
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
      className="absolute inset-0 z-[100] pointer-events-none"
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
                  freezeTrackerForSummary()
                  setSummarySnapshot(buildSummarySnapshot(0))
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
        <div className={`absolute inset-0 z-0 ${isPaused && viewMode === 'dashboard' ? 'pointer-events-none' : 'pointer-events-auto'}`}>
          <RunningMap
            userLocation={runningMapUserLocation}
            path={path}
            onLocationUpdate={onManualLocation}
            recenterTrigger={recenterTrigger}
            showKingdom={showKingdom}
          />
          {viewMode === 'dashboard' && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />
          )}
        </div>
      )}

      {viewMode === 'dashboard' && (
        <div className="absolute inset-0 z-50 pointer-events-auto bg-slate-900/95 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+20px)]">
          <div className="flex h-full flex-col">
            <div className="grid grid-cols-2 gap-3 rounded-3xl border border-white/10 bg-black/30 p-4">
              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <p className="text-[11px] text-white/60">公里数</p>
                <p className="mt-1 text-3xl font-black text-white">{(distanceMeters / 1000).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <p className="text-[11px] text-white/60">配速</p>
                <p className="mt-1 text-3xl font-black text-white">{pace ? String(pace) : "00:00"}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <p className="text-[11px] text-white/60">千卡</p>
                <p className="mt-1 text-3xl font-black text-white">{Math.round(calories)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 text-center">
                <p className="text-[11px] text-white/60">时长</p>
                <p className="mt-1 text-3xl font-black text-white">{time}</p>
              </div>
            </div>

            <div className="mt-auto space-y-4">
              <DashboardActionRow
                onLock={handleLockScreen}
                onOpenMap={handleOpenMapView}
                onToggleKingdom={handleToggleKingdom}
              />
              <RunControlButtons
                isPaused={isPaused}
                isEndPressing={isEndPressing}
                onPauseToggle={handlePauseToggle}
                onEndPressStart={handleEndPressStart}
                onEndPressEnd={handleEndPressEnd}
                singleButtonClassName="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-black text-white shadow-xl active:scale-[0.99]"
                pairButtonClassName="h-14 w-full rounded-2xl text-lg font-black text-white shadow-xl transition active:scale-[0.99]"
                pairWrapperClassName="grid grid-cols-2 gap-3"
                singleLabelClassName="h-14 w-full rounded-2xl bg-emerald-500 text-lg font-black text-white shadow-xl active:scale-[0.99]"
              />
            </div>
          </div>
        </div>
      )}

      {viewMode === 'map' && (
        <div className="absolute inset-0 z-50 flex flex-col pointer-events-none">
          <MapTopBar onBack={handleBackToDashboard} onRecenter={handleRecenter} />

          <div className="pointer-events-auto z-50 mt-auto rounded-t-3xl border border-white/10 bg-slate-900/92 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-[11px] text-white/60">公里数</p>
                <p className="mt-1 text-2xl font-black text-white">{(distanceMeters / 1000).toFixed(2)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-[11px] text-white/60">预计面积</p>
                <p className="mt-1 text-2xl font-black text-emerald-300">{formatArea(area).fullText}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-[11px] text-white/60">配速</p>
                <p className="mt-1 text-2xl font-black text-white">{pace ? String(pace) : "00:00"}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-[11px] text-white/60">时长</p>
                <p className="mt-1 text-2xl font-black text-white">{time}</p>
              </div>
            </div>
            <RunControlButtons
              isPaused={isPaused}
              isEndPressing={isEndPressing}
              onPauseToggle={handlePauseToggle}
              onEndPressStart={handleEndPressStart}
              onEndPressEnd={handleEndPressEnd}
              singleButtonClassName="mt-4 h-12 w-full rounded-2xl bg-emerald-500 text-base font-black text-white active:scale-[0.99]"
              pairButtonClassName="h-12 w-full rounded-2xl text-base font-black text-white shadow-xl transition active:scale-[0.99]"
              pairWrapperClassName="mt-4 grid grid-cols-2 gap-3"
              singleLabelClassName="h-12 w-full rounded-2xl bg-emerald-500 text-base font-black text-white active:scale-[0.99]"
            />
          </div>
        </div>
      )}

      {isScreenLocked && (
        <div className="fixed inset-0 z-[99999] pointer-events-auto bg-black/60 backdrop-blur-sm">
          <div className="flex h-full w-full items-center justify-center px-6">
            <button
              type="button"
              className={`h-28 w-28 rounded-full border-2 border-white/40 bg-white/10 text-sm font-black text-white transition ${isUnlockPressing ? "scale-95 bg-white/20" : "scale-100"}`}
              onPointerDown={handleUnlockPressStart}
              onPointerUp={handleUnlockPressEnd}
              onPointerLeave={handleUnlockPressEnd}
              onPointerCancel={handleUnlockPressEnd}
            >
              {isUnlockPressing ? "继续按住..." : "按住解锁"}
            </button>
          </div>
        </div>
      )}
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

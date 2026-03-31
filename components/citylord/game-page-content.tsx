"use client"

import nextDynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback, memo } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { logEvent } from '@/lib/native-log';
import { BottomNav, TabType } from "@/components/citylord/bottom-nav"
import { MissionCenter } from "@/components/citylord/MissionCenter"
import { Profile } from "@/components/citylord/profile"
import { Trophy, History, Loader2, Palette, MapPin, Crown, ClipboardList, Users } from "lucide-react";
import { OnboardingGuide, ONBOARDING_GUIDE_STEP_COUNT } from "@/components/citylord/onboarding-guide"
import { TerritoryAlert } from "@/components/citylord/territory-alert"
import { ChallengeInvite } from "@/components/citylord/challenge-invite"
import { AchievementPopup } from "@/components/citylord/achievement-popup"
import { SocialPage } from "@/components/citylord/social/social-page"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WelcomeScreen, InteractiveTutorial, QuickNavPopup, MapInteractionGuide } from "@/components/citylord/onboarding/complete-onboarding"
import { MapHeader, MapHeaderProps } from "@/components/map/MapHeader"
import { LoadingScreen } from "@/components/citylord/loading-screen"
import { useRunningTracker } from "@/hooks/useRunningTracker"
import useSWR from 'swr'
import { LeaderboardDrawer } from "@/components/leaderboard/LeaderboardDrawer"
import { useCity } from "@/contexts/CityContext"
import {
  NetworkBanner,
  LocationPermissionPrompt,
} from "@/components/citylord/feedback/error-feedback"
import { useLocationContext } from "@/components/GlobalLocationProvider";
import { useGameStore, useGameActions, useGameUser } from "@/store/useGameStore";
import { useHydration } from "@/hooks/useHydration";
import { ThemeSwitcher } from "@/components/citylord/theme/theme-provider";
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { SinglePlayer } from '@/components/mode/SinglePlayer';
import { PrivateLobby } from '@/components/mode/PrivateLobby';
import { MyClub } from '@/components/mode/MyClub';
import { AMapViewHandle, ViewportKingData } from "@/components/map/AMapView";
import { FactionSelector } from "@/components/social/FactionSelector"
import { ReferralWelcome } from "@/components/social/ReferralWelcome"
import { useSearchParams, useRouter } from 'next/navigation'
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"
import { RunHistoryDrawer } from "@/components/map/RunHistoryDrawer"
import { CountdownOverlay } from "@/components/running/CountdownOverlay"
import { StartRunOverlay } from "@/components/citylord/start/StartRunPageClient"
// OneSignal removed
import { isNativePlatform, safeRequestGeolocationPermission, safeRequestLocalNotificationPermission, safeScheduleLocalNotification } from "@/lib/capacitor/safe-plugins"
import { safeLoadAMap } from '@/lib/map/safe-amap';
import { ImmersiveSkeleton } from "@/components/citylord/running/ImmersiveSkeleton";
import { MapSkeleton } from "@/components/map/MapSkeleton";
import { GameHomePage } from "@/components/citylord/home/GameHomePage";
import type { RunMode } from "@/types/home";

// --- Step 1: Memoize Heavy Components ---

const MemoizedImmersiveRunningMode = memo(nextDynamic(() => import("@/components/citylord/running/immersive-mode").then(mod => mod.ImmersiveRunningMode), { ssr: false }));

const MemoizedAMapView = memo(nextDynamic(() => import("@/components/map/AMapViewWithProvider").then(mod => mod.AMapViewWithProvider), {
  ssr: false,
  loading: () => <MapSkeleton className="absolute inset-0 w-full h-full" />
}));

// Wrap standard components
const MemoizedMissionCenter = memo(MissionCenter);
const MemoizedSocialPage = memo(SocialPage);
const MemoizedProfile = memo(Profile);
const MemoizedLeaderboardDrawer = memo(LeaderboardDrawer);
const MemoizedPrivateLobby = memo(PrivateLobby);
const MemoizedSinglePlayer = memo(SinglePlayer);
const MemoizedMyClub = memo(MyClub);
const MemoizedBottomNav = memo(BottomNav);
const MemoizedFactionSelector = memo(FactionSelector);
const MemoizedReferralWelcome = memo(ReferralWelcome);
const MemoizedMapHeader = memo(MapHeader) as React.NamedExoticComponent<MapHeaderProps>;
const MemoizedModeSwitcher = memo(ModeSwitcher);
const MemoizedRunHistoryDrawer = memo(RunHistoryDrawer);
const MemoizedTerritoryAlert = memo(TerritoryAlert);
const MemoizedChallengeInvite = memo(ChallengeInvite);
const MemoizedAchievementPopup = memo(AchievementPopup);
const MemoizedNetworkBanner = memo(NetworkBanner);
// Removed GpsWeakPopup per user request

interface GamePageContentProps {
  initialMissions?: any[]
  initialStats?: any
  initialFactionStats?: any
  initialBadges?: any[]
  initialFriends?: any[]
  initialFriendRequests?: any[]
  initialUser?: any
}

const VALID_TABS: TabType[] = ['home', 'play', 'start', 'missions', 'social', 'profile', 'leaderboard', 'mode'];
const ONBOARDING_STATUS_KEY = 'citylord_onboarding_status'
const ONBOARDING_STEP_KEY = 'citylord_onboarding_step'

type OnboardingStatus = 'pending_welcome' | 'pending_guide' | 'completed'

export function GamePageContent({
  initialMissions = [],
  initialStats,
  initialFactionStats,
  initialBadges = [],
  initialFriends = [],
  initialFriendRequests = [],
  initialUser
}: GamePageContentProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isAuthenticated, loading: isAuthLoading } = useAuth(initialUser)
  const { isLoading: isCityLoading, currentCity } = useCity()
  const { checkStaminaRecovery, dismissGeolocationPrompt, claimAchievement, addTotalDistance, openDrawer, closeDrawer } = useGameActions()
  const { achievements, totalDistance } = useGameUser()
  const { initializeLocationSystem } = useLocationContext()
  const hydrated = useHydration();
  const prefersReducedMotion = useReducedMotion();
  const mapViewRef = useRef<AMapViewHandle>(null);
  const [showTerritory, setShowTerritory] = useState(true);
  const [viewportKing, setViewportKing] = useState<ViewportKingData | null>(null);
  const hasAttemptedFirstInit = useRef(false);

  // 全屏加载状态 - 必须在所有 hooks 之后 return
  // Feature: 页面缓存 — 优先 URL 参数(深度链接) > localStorage 缓存 > 默认 "play"
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab');
      if (urlTab && VALID_TABS.includes(urlTab as TabType)) {
        return urlTab as TabType;
      }
      const cached = localStorage.getItem('citylord_last_tab');
      if (cached && VALID_TABS.includes(cached as TabType)) {
        return cached as TabType;
      }
    }
    return 'home';
  })

  // [Anti-Crash] Android 14+ 定位系统受控初始化
  // 仅在注水完成 + 用户登录 + 页面可见时触发
  useEffect(() => {
    if (hydrated && isAuthenticated && document.visibilityState === 'visible') {
      const isFirstTime = !hasAttemptedFirstInit.current;
      console.log(`[GamePageContent] Conditions met, initializing location system (isFirstTime: ${isFirstTime})...`);
      
      // [NEW] 只有首次进入 App 时，才允许弹出系统定位权限框 (onlyIfGranted: false)
      // 后续返回、切换 Visible 场景均保持静默检测
      initializeLocationSystem({ onlyIfGranted: !isFirstTime }).catch((err: any) => {
        console.error('[GamePageContent] Failed to initialize location system:', err);
      });
      
      hasAttemptedFirstInit.current = true;
    }

    // 监听切回前台，确保即便首次启动时被系统阻断，回到 App 后仍能再次激活
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && hydrated && isAuthenticated) {
        // 切回前台场景，坚持静默检查，不主动弹出打扰
        initializeLocationSystem({ onlyIfGranted: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [hydrated, isAuthenticated, initializeLocationSystem]);

  // Sync activeTab to URL + localStorage on every change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeTab);
      window.history.replaceState({}, '', url.toString());
      localStorage.setItem('citylord_last_tab', activeTab);
    }
  }, [activeTab]);

  // Realtime Battle Alerts
  // ⚠️ DESIGN NOTE: 这里订阅 notifications 表是有意的双通道设计。
  // 本处负责：触发本地通知 (Native) / Toast (Web)
  // notification-center.tsx (NotificationProvider) 负责：更新通知列表 UI
  // 两者监听同一张表但处理不同的 UI 反馈，请勿合并或删除。
  useEffect(() => {
    if (!user?.id) return;

    // 移除了挂载时自动请求通知权限 (Local Notification Permission) 的逻辑
    // 以防止冷启动弹窗影响体验
    // requestPermissions();

    const supabase = createClient();

    // Listen to NOTIFICATIONS table instead of territories
    const channel = supabase.channel('personal-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, async (payload: any) => {
        console.log('New Notification Received:', payload);

        if (payload.new) {
          const { title, body, data } = payload.new;

          // 1. Trigger Local Notification (Native)
          if (await isNativePlatform()) {
            try {
              await safeScheduleLocalNotification({
                notifications: [{
                  title: title,
                  body: body,
                  id: Math.floor(Math.random() * 100000),
                  schedule: { at: new Date(Date.now() + 100) }, // Immediate
                  sound: 'res://raw/notification_sound', // Optional: Custom sound if added
                  extra: data
                }]
              });
            } catch (err) {
              console.warn("LocalNotification schedule failed:", err);
            }
          } else {

            // Web Fallback: Toast
            toast(title, {
              description: body,
              duration: 5000,
              action: {
                label: "查看",
                onClick: () => setActiveTab('social') // Or specific tab
              }
            });
          }

          // 2. Play Sound (In-App)
          try {
            const audio = new Audio('/sounds/alert.mp3');
            audio.play().catch(e => console.log('Audio play failed', e));
          } catch (e) { }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); }
  }, [user?.id]);

  // Mission Count
  const [missionCount, setMissionCount] = useState(0)
  const [missionsInitialFilter, setMissionsInitialFilter] = useState<'all' | 'daily' | 'weekly'>('all')

  // Initialize mission count from props
  useEffect(() => {
    if (initialMissions && initialMissions.length > 0) {
      const claimable = initialMissions.filter((m: any) => m.status === 'completed').length
      setMissionCount(claimable)
    }
  }, [initialMissions])

  const [isRunning, setIsRunning] = useState(false)
  const [showImmersiveMode, setShowImmersiveMode] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const isImmersiveActive = showImmersiveMode || isRunning

  // Running Tracker
  const {
    distance,
    pace,
    duration,
    calories,
    currentLocation,
    path,
    closedPolygons,
    sessionClaims, // NEW: Claimed polygons for rendering
    togglePause: toggleTrackerPause,
    stop: stopTracker,
    clearRecovery,
    addManualLocation,
    saveRun, // NEW: Persistence function
    // Raw data contract
    distanceMeters,
    durationSeconds,
    steps,
    area,
    savedRunId,
    runNumber,
    damageSummary,
    maintenanceSummary,
    runIsValid,
    antiCheatLog,
    idempotencyKey,
    eventsHistory,
    activeRandomEvent,
    randomEventCountdownSeconds,
  } = useRunningTracker(isRunning, user?.id)

  // Crash Recovery Check
  const [hasCheckedRecovery, setHasCheckedRecovery] = useState(false);

  useEffect(() => {
    if (hasCheckedRecovery) return;
    setHasCheckedRecovery(true);

    const RECOVERY_KEY = 'CURRENT_RUN_RECOVERY';
    const recoveryJson = localStorage.getItem(RECOVERY_KEY);
    if (recoveryJson) {
      try {
        const data = JSON.parse(recoveryJson);
        
        // 1. 基础有效性检查 (24h 超时 + 版本匹配)
        const isSessionValid = data.startTime && 
                             (Date.now() - data.startTime < 24 * 60 * 60 * 1000) && 
                             data.isRunning && 
                             data.sessionVersion === '2.0';

        if (isSessionValid) {
          console.log("[Recovery] Valid session found, restoring UI...", data.runId);
          logEvent('run_session_found', { runId: data.runId });

          setIsRunning(true);
          setShowImmersiveMode(true);
          setActiveTab('play'); 
          
          logEvent('run_session_restore_success', { runId: data.runId });
        } else if (data.isRunning) {
          console.log("[Recovery] Session expired or version mismatch, cleaning up...");
          localStorage.removeItem(RECOVERY_KEY);
          logEvent('run_session_restore_failed', { reason: 'expired_or_invalid_version', runId: data.runId });
        }
      } catch (e) {
        console.warn("[Recovery] Invalid data, cleaning up...", e);
        localStorage.removeItem(RECOVERY_KEY);
      }
    }
  }, [hasCheckedRecovery]);

  // Reset missionsInitialFilter when leaving missions tab
  useEffect(() => {
    if (activeTab !== 'missions') {
      setMissionsInitialFilter('all')
    }
  }, [activeTab]);

  const [sessionHexes, setSessionHexes] = useState(0)

  // Reset hexes when starting run
  useEffect(() => {
    if (isRunning) {
      setSessionHexes(0)
    }
  }, [isRunning])

  // Interactive popup states
  const [showTerritoryAlert, setShowTerritoryAlert] = useState(false)
  const [showChallengeInvite, setShowChallengeInvite] = useState(false)
  const [showAchievement, setShowAchievement] = useState(false)
  const [currentUnlockedAchievement, setCurrentUnlockedAchievement] = useState<any>(null)

  // New onboarding states
  const [showWelcome, setShowWelcome] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [showQuickNav, setShowQuickNav] = useState(false)
  const [showMapGuide, setShowMapGuide] = useState(false)
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false)
  const [hasResolvedOnboarding, setHasResolvedOnboarding] = useState(false)
  const [shouldHideButtons, setShouldHideButtons] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);

  // Animation demo states
  const [showCaptureEffect, setShowCaptureEffect] = useState(false)
  const [capturePosition, setCapturePosition] = useState({ x: 200, y: 300 })

  // Error/feedback states
  // GPS weak popup state removed per user request
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [gpsStrength, setGpsStrength] = useState(5)

  // Map View Mode (User vs Club)
  const [mapViewMode, setMapViewMode] = useState<'user' | 'club'>('user');

  // Get user location from store - use stable selectors to avoid unnecessary re-renders
  const userLat = useGameStore((state) => state.latitude)
  const userLng = useGameStore((state) => state.longitude)
  const gameMode = useGameStore((state) => state.gameMode);
  const gpsError = useGameStore((state) => state.gpsError);
  const activeDrawer = useGameStore((state) => state.activeDrawer);
  const hasDismissedGeolocationPrompt = useGameStore((state) => state.hasDismissedGeolocationPrompt);
  const isRunTakeoverActive = isCountingDown || isImmersiveActive
  const shouldRenderPlaySurface = activeTab === "home" || activeTab === "play" || activeTab === "start" || isRunTakeoverActive
  const shouldShowPlayChrome = activeTab === "play" && !isRunTakeoverActive

  // Check if first visit - 只在首次挂载时执行
  useEffect(() => {
    let isMounted = true

    // OneSignal removed

    async function checkSession() {
      // If we have initialUser from server, we can skip some checks or just verify
      if (initialUser) {
        return
      }

      console.log('[Page] Checking session...')
      // 检查 Supabase Session
      const supabase = createClient()

      // Check for session_refreshed param
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('session_refreshed') === 'true') {
        console.log('[Page] Detected session_refreshed param, forcing re-check');
        // Clear the param
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      // Check if we have an access token in the URL (implicit grant/magic link)
      const hash = window.location.hash
      const hasAccessToken = hash.includes('access_token')

      if (hasAccessToken) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
            if (window.history.replaceState) {
              window.history.replaceState(null, '', window.location.pathname);
            }
          }
        })

        setTimeout(() => {
          if (isMounted) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              if (session) {
                if (window.history.replaceState && window.location.hash.includes('access_token')) {
                  window.history.replaceState(null, '', window.location.pathname);
                }
              }
            })
          }
        }, 3000)

        return
      }

      const { data: { session }, error } = await supabase.auth.getSession().catch(err => {
        console.error("Session check failed:", err);
        return { data: { session: null }, error: err };
      });

      if (!isMounted) return

      if (error) {
        console.warn("Session check returned error:", error.message);
      }
    }

    checkSession()

    return () => { isMounted = false }
  }, [initialUser])

  useEffect(() => {
    if (!hydrated) return

    setHasResolvedOnboarding(false)
    if (isAuthLoading) return

    const debounceTimer = window.setTimeout(() => {
      const storedStatus = localStorage.getItem(ONBOARDING_STATUS_KEY)
      const hasVisited = localStorage.getItem('hasVisited') === 'true'

      let nextStatus: OnboardingStatus
      if (storedStatus === 'pending_welcome' || storedStatus === 'pending_guide' || storedStatus === 'completed') {
        nextStatus = storedStatus
      } else {
        nextStatus = hasVisited ? 'pending_guide' : 'pending_welcome'
      }

      const rawStep = Number.parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) ?? '0', 10)
      const maxStepIndex = ONBOARDING_GUIDE_STEP_COUNT - 1
      const nextStep = Number.isFinite(rawStep) && rawStep >= 0 && rawStep <= maxStepIndex ? rawStep : 0

      if (!hasVisited) {
        localStorage.setItem('hasVisited', 'true')
      }

      localStorage.setItem(ONBOARDING_STATUS_KEY, nextStatus)
      if (nextStatus === 'pending_guide') {
        localStorage.setItem(ONBOARDING_STEP_KEY, String(nextStep))
      } else {
        localStorage.removeItem(ONBOARDING_STEP_KEY)
      }

      setShowWelcome(nextStatus === 'pending_welcome')
      setShowOnboarding(nextStatus === 'pending_guide')
      setOnboardingStep(nextStatus === 'pending_guide' ? nextStep : 0)
      setHasResolvedOnboarding(true)
    }, 180)

    return () => window.clearTimeout(debounceTimer)
  }, [hydrated, isAuthenticated, isAuthLoading])

  useEffect(() => {
    const refId = searchParams.get('ref')
    if (refId) {
      document.cookie = `referral_id=${refId}; path=/; max-age=86400`
    }
  }, [searchParams])

  // Stamina Recovery Timer
  useEffect(() => {
    checkStaminaRecovery()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkStaminaRecovery()
      }
    }, 60000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStaminaRecovery()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [checkStaminaRecovery])

  const { data: friends } = useSWR('friends', async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/social/friends`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch friends')
    return res.json()
  })

  const handleWelcomeComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STATUS_KEY, 'pending_guide')
      localStorage.setItem(ONBOARDING_STEP_KEY, '0')
    }
    setShowWelcome(false)
    setShowOnboarding(true)
    setOnboardingStep(0)
  }, [])

  const handleOnboardingComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STATUS_KEY, 'completed')
      localStorage.removeItem(ONBOARDING_STEP_KEY)
    }
    setShowWelcome(false)
    setShowOnboarding(false)
    setOnboardingStep(0)
  }, [])

  const handleOnboardingStepChange = useCallback((step: number) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STATUS_KEY, 'pending_guide')
      localStorage.setItem(ONBOARDING_STEP_KEY, String(step))
    }
    setOnboardingStep(step)
  }, [])

  // Countdown Audio Ref
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- Step 2: Stable Handlers ---

  const startCountdown = useCallback(() => {
    // Force Play Audio immediately on user interaction
    console.log('Attempting to play: countdown.mp3');
    try {
      const audio = new Audio('/sounds/countdown.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => console.error("Play failed", e));
      countdownAudioRef.current = audio;
    } catch (e) { }

    // Show overlay
    setIsCountingDown(true)
  }, [])

  const beginRunStart = useCallback(() => {
    if (!isAuthenticated) {
      toast.warning('请先登录才能开始占领领地！')
      return false
    }

    setActiveTab("play")
    startCountdown()
    return true
  }, [isAuthenticated, startCountdown])

  const handleQuickNavigate = useCallback((tab: string, options?: { initialFilter?: 'all' | 'daily' | 'weekly' }) => {
    if (options?.initialFilter) {
      setMissionsInitialFilter(options.initialFilter);
    }

    if (tab === "running") {
      setActiveTab("start")
    } else {
      setActiveTab(tab as TabType)
    }
  }, [])

  const handleShowDemo = useCallback((type: "territory" | "challenge" | "achievement") => {
    if (type === "territory") setShowTerritoryAlert(true)
    if (type === "challenge") setShowChallengeInvite(true)
    if (type === "achievement") setShowAchievement(true)
  }, [])

  const triggerCaptureEffect = useCallback(() => {
    setCapturePosition({
      x: 100 + Math.random() * 200,
      y: 200 + Math.random() * 200
    })
    setShowCaptureEffect(true)
  }, [])

  const handleOpenSettings = useCallback(async () => {
    try {
      if (await isNativePlatform()) {
        await safeRequestGeolocationPermission();
      } else {

        toast.info("请在浏览器设置中开启定位权限");
      }
    } catch (e) {
      console.error("Failed to open settings", e);
      toast.error("无法打开设置");
    }
  }, []);

  const handleOpenThemeSettings = useCallback(() => setShowThemeSwitcher(true), []);

  // Stable handlers for heavy components to prevent re-renders
  const handleDrawerOpenChange = useCallback((isOpen: boolean) => {
    setShouldHideButtons(isOpen);
  }, []);

  const handlePlannerOpen = useCallback(() => {
    router.push('/game/planner');
  }, [router]);

  const handleRunHistoryOpen = useCallback(() => {
    openDrawer('runHistory');
  }, [openDrawer]);

  const handleLeaderboardOpen = useCallback(() => {
    openDrawer('leaderboard');
  }, [openDrawer]);

  const handleCloseQuickNav = useCallback(() => {
    setShowQuickNav(false);
  }, []);

  const handleCloseMapGuide = useCallback(() => {
    setShowMapGuide(false);
  }, []);

  const handleCloseThemeSwitcher = useCallback(() => {
    setShowThemeSwitcher(false);
  }, []);

  const handleCounterAttack = useCallback(() => {
    setShowTerritoryAlert(false)
    setActiveTab("play")
  }, []);

  const handleViewMap = useCallback(() => {
    setShowTerritoryAlert(false)
    setActiveTab("play")
  }, []);

  const handleAcceptChallenge = useCallback(() => {
    setShowChallengeInvite(false)
    setActiveTab("play")
    startCountdown()
  }, [startCountdown]);

  const handleClaimAchievement = useCallback(() => {
    if (currentUnlockedAchievement) {
      localStorage.setItem(`achievement_${currentUnlockedAchievement.id}_claimed`, 'true')
      claimAchievement(currentUnlockedAchievement.id)
    } else {
      localStorage.setItem('achievement_marathon-hero_claimed', 'true')
      claimAchievement('marathon-hero')
    }
    setShowAchievement(false)
  }, [currentUnlockedAchievement, claimAchievement]);

  // GPS retry handler removed per user request

  const handleHexClaimed = useCallback(() => {
    setSessionHexes(prev => prev + 1)
    setShowCaptureEffect(true)
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setIsCountingDown(false)
    setIsRunning(true)
    setShowImmersiveMode(true)
    setActiveTab("play")
  }, []);

  // Complex stop handler
  const handleStopRun = useCallback(() => {
    stopTracker()
    clearRecovery()
    setIsRunning(false)
    setShowImmersiveMode(false)
    setActiveTab("home")

    const currentRunDistance = distance || 0
    addTotalDistance(currentRunDistance)
    const newTotalDistance = (totalDistance || 0) + currentRunDistance

    // Explicitly clear recovery key again to be safe
    if (typeof window !== 'undefined') {
      localStorage.removeItem('CURRENT_RUN_RECOVERY');
    }

    // Check for achievements based on distance
    if (!achievements?.['marathon-god'] && newTotalDistance >= 42195) {
      const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'marathon-god');
      if (def) {
        setCurrentUnlockedAchievement(def);
        setShowAchievement(true);
        return;
      }
    }

    if (!achievements?.['city-walker'] && newTotalDistance >= 10000) {
      const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'city-walker');
      if (def) {
        setCurrentUnlockedAchievement(def);
        setShowAchievement(true);
      }
    }
  }, [distance, totalDistance, achievements, stopTracker, clearRecovery, addTotalDistance]);

  const handleMapLoad = useCallback(() => { }, []);

  const handleExpand = useCallback(() => { }, []);

  return (
    <div className="relative w-full h-[100dvh] max-w-md mx-auto bg-[#0f172a] overflow-hidden flex flex-col">
      {!hydrated && <LoadingScreen message="正在初始化..." />}
      {(isCityLoading || !currentCity) && hydrated && <LoadingScreen message="正在加载城市数据..." />}

      <WelcomeScreen
        isOpen={showWelcome}
        onComplete={handleWelcomeComplete}
        userName="跑者"
      />

      <InteractiveTutorial
        isOpen={showTutorial}
        onComplete={() => setShowTutorial(false)}
        currentStep={tutorialStep}
        onStepChange={setTutorialStep}
      />

      <QuickNavPopup
        isOpen={showQuickNav}
        onClose={handleCloseQuickNav}
        onNavigate={handleQuickNavigate}
        missionCount={missionCount}
      />

      <MapInteractionGuide
        isOpen={showMapGuide}
        onClose={handleCloseMapGuide}
      />

      <ThemeSwitcher
        isOpen={showThemeSwitcher}
        onClose={handleCloseThemeSwitcher}
      />

      {hasResolvedOnboarding && (
        <OnboardingGuide
          isVisible={showOnboarding}
          currentStep={onboardingStep}
          onStepChange={handleOnboardingStepChange}
          onComplete={handleOnboardingComplete}
        />
      )}

      {isCountingDown && (
        <CountdownOverlay
          onComplete={handleCountdownComplete}
        />
      )}

      <LocationPermissionPrompt
        isOpen={hydrated && gpsError === 'PERMISSION_DENIED' && !hasDismissedGeolocationPrompt}
        onClose={dismissGeolocationPrompt}
        onOpenSettings={handleOpenSettings}
      />


      {hydrated && currentCity && (
        <main className="relative flex-1 overflow-hidden">
          {shouldRenderPlaySurface && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 z-0">
                <MemoizedAMapView
                  ref={mapViewRef}
                  showTerritory={showTerritory}
                  onMapLoad={handleMapLoad}
                  sessionClaims={sessionClaims}
                  onViewportKingChange={setViewportKing}
                />
                {shouldShowPlayChrome && <MemoizedFactionSelector initialUser={initialUser} />}
                {shouldShowPlayChrome && <MemoizedReferralWelcome />}
              </div>

              <div className="relative z-10 h-full w-full pointer-events-none">
                {shouldShowPlayChrome && (
                  <>
                    <div className="pointer-events-auto">
                      <MemoizedMapHeader setShowThemeSwitcher={setShowThemeSwitcher} />
                    </div>

                    <div className="pointer-events-auto">
                      <MemoizedModeSwitcher onDrawerOpenChange={handleDrawerOpenChange} />
                    </div>

                    <AnimatePresence mode="wait">
                      {gameMode === 'map' && viewportKing && (
                        <motion.div
                          key={viewportKing.ownerId}
                          initial={{ opacity: 0, y: -48, scale: 0.92 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -32, scale: 0.97 }}
                          transition={prefersReducedMotion ? { duration: 0.18 } : { type: 'spring', stiffness: 240, damping: 24 }}
                          className="pointer-events-auto absolute top-[132px] left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.25rem)] max-w-md overflow-hidden rounded-[24px] border border-amber-300/35 bg-black/70 px-4 py-3 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                        >
                          <motion.div
                            aria-hidden
                            className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(251,191,36,0.08)_35%,rgba(255,255,255,0.18)_50%,rgba(251,191,36,0.08)_65%,transparent_100%)]"
                            animate={prefersReducedMotion ? { opacity: 0.45 } : { x: ['-120%', '120%'] }}
                            transition={prefersReducedMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'linear' }}
                          />
                          <div className="relative flex items-center gap-3">
                            <motion.div
                              className="relative h-12 w-12 shrink-0 rounded-full border border-amber-200/50 bg-black/40 overflow-hidden flex items-center justify-center"
                              animate={prefersReducedMotion ? undefined : { boxShadow: ['0 0 0 rgba(251,191,36,0.1)', '0 0 24px rgba(251,191,36,0.45)', '0 0 0 rgba(251,191,36,0.12)'] }}
                              transition={prefersReducedMotion ? undefined : { duration: 1.8, repeat: Infinity }}
                            >
                              <motion.div
                                aria-hidden
                                className="absolute inset-0 rounded-full border border-amber-300/35"
                                animate={prefersReducedMotion ? undefined : { scale: [1, 1.18, 1], opacity: [0.2, 0.55, 0.2] }}
                                transition={prefersReducedMotion ? undefined : { duration: 1.6, repeat: Infinity }}
                              />
                              {viewportKing.avatarUrl ? (
                                <img src={viewportKing.avatarUrl} alt={viewportKing.nickname} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold text-white/80">{viewportKing.nickname.slice(0, 1)}</span>
                              )}
                            </motion.div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-amber-300">
                                <motion.div
                                  animate={prefersReducedMotion ? undefined : { rotate: [-8, 8, -6, 6, 0] }}
                                  transition={prefersReducedMotion ? undefined : { duration: 0.9 }}
                                >
                                  <Crown className="h-4 w-4" />
                                </motion.div>
                                <span className="text-[10px] font-semibold tracking-[0.28em]">区域霸主登基</span>
                              </div>
                              <p className="truncate text-base font-black text-white">{viewportKing.nickname}</p>
                              <p className="text-[11px] text-white/70">统治面积 {Math.round(viewportKing.totalArea).toLocaleString('zh-CN')} m²</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!shouldHideButtons && (
                      <div className="pointer-events-auto absolute top-[130px] left-4 z-20 flex flex-col gap-4">
                        <div className="group relative flex items-center">
                          <button
                            onClick={handleOpenThemeSettings}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground"
                          >
                            <Palette className="h-5 w-5" />
                          </button>
                          <span className="absolute left-12 pointer-events-none opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10">切换主题</span>
                        </div>

                        <div className="group relative flex items-center">
                          <button
                            onClick={handleRunHistoryOpen}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground"
                          >
                            <History className="h-5 w-5" />
                          </button>
                          <span className="absolute left-12 pointer-events-none opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10">跑步历史</span>
                        </div>

                        <div className="group relative flex items-center">
                          <button
                            onClick={handleLeaderboardOpen}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground"
                          >
                            <Trophy className="h-5 w-5" />
                          </button>
                          <span className="absolute left-12 pointer-events-none opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10">查看排行榜</span>
                        </div>
                      </div>
                    )}

                    {gameMode === 'map' && !shouldHideButtons && (
                      <div className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] left-4 z-[60] flex flex-col gap-3">
                        <button
                          onClick={() => setActiveTab("missions")}
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-md text-[#8b5cf6] active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50"
                          aria-label="任务中心"
                        >
                          <ClipboardList className="h-5 w-5" />
                        </button>
                      </div>
                    )}

                    {gameMode === 'map' && !shouldHideButtons && (
                      <div className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-[60] flex flex-col gap-3">
                        <button
                          onClick={() => setActiveTab("social")}
                          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-md text-[#3b82f6] active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50"
                          aria-label="好友"
                        >
                          <Users className="h-5 w-5" />
                          {(friends?.length || 0) > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                              {friends!.length > 99 ? '99+' : friends!.length}
                            </span>
                          )}
                        </button>
                      </div>
                    )}

                    {gameMode !== 'map' && !shouldHideButtons && (
                      <div className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[calc(100%-2rem)] max-w-md">
                        <div className="mx-auto max-h-[70vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl p-6">
                          {gameMode === 'single' && <MemoizedSinglePlayer />}
                          {gameMode === 'private' && <MemoizedPrivateLobby />}
                          {gameMode === 'club' && <MemoizedMyClub hasClub={true} />}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!isRunTakeoverActive && activeTab === "start" && (
                  <StartRunOverlay
                    onBack={() => setActiveTab("home")}
                    onBeginRun={() => {
                      beginRunStart()
                    }}
                  />
                )}
              </div>
            </div>
          )}

          {!isRunTakeoverActive && activeTab === "home" && (
            <div className="absolute inset-0 bg-[#0f172a] z-40">
              <GameHomePage
                onStartRun={(_mode: RunMode) => setActiveTab('start')}
                onNavigateToMap={(targetId) => {
                  setActiveTab('play');
                }}
                onNavigateToTab={(tab) => setActiveTab(tab as TabType)}
                onSmartPlan={handlePlannerOpen}
              />
            </div>
          )}

          {!isRunTakeoverActive && activeTab === "mode" && (
            <div className="relative h-dvh w-full overflow-hidden">
              <MemoizedAMapView ref={mapViewRef} showTerritory={showTerritory} viewMode={mapViewMode} sessionClaims={sessionClaims} />
              <div className="relative z-10 h-full w-full pointer-events-none">
                <div className="pointer-events-auto">
                  <MemoizedMapHeader
                    setShowThemeSwitcher={setShowThemeSwitcher}
                    viewMode={mapViewMode}
                    onViewModeChange={setMapViewMode}
                  />
                </div>
                <div className="pointer-events-auto">
                  <MemoizedModeSwitcher onDrawerOpenChange={handleDrawerOpenChange} />
                </div>
              </div>
            </div>
          )}

          {!isRunTakeoverActive && activeTab === "missions" && (
            <div className="flex-1 w-full h-full bg-[#0f172a] z-40 relative">
              <MemoizedMissionCenter initialData={initialMissions} initialFilter={missionsInitialFilter} />
            </div>
          )}

          {/* Leaderboard replaced by Drawer */}

          {!isRunTakeoverActive && activeTab === "social" && (
            <div id="nav-social" className="flex-1 w-full h-full bg-[#0f172a] z-40 relative">
              <MemoizedSocialPage
                onShowDemo={handleShowDemo}
                initialFriends={initialFriends}
                initialRequests={initialFriendRequests}
              />
            </div>
          )}

          {!isRunTakeoverActive && activeTab === "profile" && (
            <div className="flex-1 w-full h-full bg-[#0f172a] z-40 relative overflow-hidden">
              <MemoizedProfile
                onOpenSettings={handleOpenThemeSettings}
                initialFactionStats={initialFactionStats}
                initialBadges={initialBadges}
              />
            </div>
          )}
        </main>
      )}

      {!hydrated ? (
        <ImmersiveSkeleton />
      ) : (
        <MemoizedImmersiveRunningMode
          isActive={isImmersiveActive}
          useSharedMapBase
          userId={user?.id}
          distance={distance}
          distanceMeters={distanceMeters}
          durationSeconds={durationSeconds}
          steps={steps}
          area={area}
          pace={pace}
          time={duration}
          calories={calories}
          heartRate={0}
          hexesCaptured={sessionHexes}
          currentHexProgress={0}
          onPause={toggleTrackerPause}
          onResume={toggleTrackerPause}
          onStop={handleStopRun}
          onManualLocation={addManualLocation}
          onExpand={handleExpand}
          currentLocation={currentLocation || (userLat && userLng ? { lat: userLat, lng: userLng } : undefined)}
          path={path}
          closedPolygons={closedPolygons}
          onHexClaimed={handleHexClaimed}
          saveRun={saveRun}
          savedRunId={savedRunId}
          runNumber={runNumber}
          damageSummary={damageSummary}
          maintenanceSummary={maintenanceSummary}
          runIsValid={runIsValid}
          antiCheatLog={antiCheatLog}
          idempotencyKey={idempotencyKey}
          eventsHistory={eventsHistory}
          activeRandomEvent={activeRandomEvent}
          randomEventCountdownSeconds={randomEventCountdownSeconds}
        />
      )}

      {hydrated && currentCity && !isRunTakeoverActive && activeTab !== "start" && <MemoizedBottomNav activeTab={activeTab} onTabChange={setActiveTab} />}

      <MemoizedTerritoryAlert
        isOpen={showTerritoryAlert}
        onClose={() => setShowTerritoryAlert(false)}
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
        onCounterAttack={handleCounterAttack}
        onViewMap={handleViewMap}
      />

      <MemoizedChallengeInvite
        isOpen={showChallengeInvite}
        onClose={() => setShowChallengeInvite(false)}
        challenger={{
          name: "SpeedRunner",
          level: 15,
          wins: 28,
          clan: "闪电战队",
        }}
        challenge={{
          type: "race",
          title: "3公里竞速赛",
          description: "比拼谁能更快完成3公里跑步",
          duration: "30分钟",
          reward: 200,
          location: "中央公园",
        }}
        onAccept={handleAcceptChallenge}
      />

      <MemoizedAchievementPopup
        isOpen={showAchievement}
        onClose={() => setShowAchievement(false)}
        achievement={currentUnlockedAchievement || {
          id: "marathon-hero",
          title: "马拉松英雄",
          description: "累计跑步距离达到42.195公里，你已成为真正的长跑者！",
          icon: "🏅",
          rarity: "epic",
          unlockedAt: new Date().toLocaleDateString('zh-CN'),
        }}
        rewards={currentUnlockedAchievement ? [
          currentUnlockedAchievement.rewards.xp && { type: "xp", amount: currentUnlockedAchievement.rewards.xp, label: "经验值" },
          currentUnlockedAchievement.rewards.coins && { type: "coins", amount: currentUnlockedAchievement.rewards.coins, label: "金币" },
          currentUnlockedAchievement.rewards.badge && { type: "badge", amount: 1, label: "专属徽章" },
          currentUnlockedAchievement.rewards.title && { type: "title", amount: 1, label: "专属称号" },
        ].filter(Boolean) : [
          { type: "xp", amount: 500, label: "经验值" },
          { type: "coins", amount: 200, label: "金币" },
          { type: "badge", amount: 1, label: "专属徽章" },
        ]}
        onClaim={handleClaimAchievement}
        onShare={() => { }}
      />

      <MemoizedNetworkBanner
        isOffline={isOffline}
        onRetry={() => setIsOffline(false)}
      />

      {/* GpsWeakPopup removed per user request */}

      <LocationPermissionPrompt
        isOpen={showPermissionPrompt}
        onClose={() => setShowPermissionPrompt(false)}
        onOpenSettings={handleOpenSettings}
      />

      <MemoizedRunHistoryDrawer
        isOpen={activeDrawer === 'runHistory'}
        onClose={closeDrawer}
      />
      <MemoizedLeaderboardDrawer />
    </div>
  )
}

import { RunningTrackerContext } from '@/contexts/RunningTrackerContext';


import { Suspense, lazy } from 'react';
const nextDynamic = (importFunc: () => Promise<any>, options: any = {}) => {
  const LazyComponent = lazy(() => importFunc().then((mod: any) => {
    if (!mod) return { default: () => null };
    if (typeof mod === 'function' || (typeof mod === 'object' && mod.$$typeof)) {
      return { default: mod };
    }
    return {
      default: mod.default || Object.values(mod)[0] || mod
    };
  }));
  return (props: any) => (
    <Suspense fallback={options.loading ? options.loading() : null}>
      <LazyComponent {...props} />
    </Suspense>
  );
};
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { logEvent } from '@/lib/native-log';
import { BottomNav, type TabType } from '@/components/citylord/bottom-nav'
import { MissionCenter } from '@/components/citylord/MissionCenter'
import { Profile } from '@/components/citylord/profile'
import { Trophy, History, Loader2, Palette, MapPin, Crown, ClipboardList, Users, Route, List } from 'lucide-react';
import { OnboardingGuide, ONBOARDING_GUIDE_STEP_COUNT } from '@/components/citylord/onboarding-guide'
import { TerritoryAlert } from '@/components/citylord/territory-alert'
import { ChallengeInvite } from '@/components/citylord/challenge-invite'
import { AchievementPopup } from '@/components/citylord/achievement-popup'
import { SocialPage } from '@/components/citylord/social/social-page'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { WelcomeScreen, InteractiveTutorial, QuickNavPopup, MapInteractionGuide } from '@/components/citylord/onboarding/complete-onboarding'
import { MapHeader, type MapHeaderProps } from '@/components/map/MapHeader'
import { LoadingScreen } from '@/components/citylord/loading-screen'
import { useRunningTracker } from '@/hooks/useRunningTracker'
import useSWR, { mutate as mutateSWR } from 'swr'
import { LeaderboardDrawer } from '@/components/leaderboard/LeaderboardDrawer'
import { useCity } from '@/contexts/CityContext'
import { NetworkBanner, LocationPermissionPrompt,  } from '@/components/citylord/feedback/error-feedback'
import { useLocationContext } from '@/components/GlobalLocationProvider';
import { useGameStore, useGameActions, useGameUser } from '@/store/useGameStore';
import { useLocationStore } from '@/store/useLocationStore';
import { useStore } from '@/store/useStore'
import { useHydration } from '@/hooks/useHydration';
import { ThemeSwitcher } from '@/components/citylord/theme/theme-provider';
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { SinglePlayer } from '@/components/mode/SinglePlayer';
import { PrivateLobby } from '@/components/mode/PrivateLobby';
import { MyClub } from '@/components/mode/MyClub';
import type { AMapViewHandle, ViewportKingData } from "@/components/map/AMapView";
import { FactionSelector } from '@/components/social/FactionSelector'
import { ReferralWelcome } from '@/components/social/ReferralWelcome'
import { useSearchParams, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { ACHIEVEMENT_DEFINITIONS } from '@/lib/achievements'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { checkRunEndAchievements } from '@/app/actions/check-achievements'
import { RunHistoryDrawer } from '@/components/map/RunHistoryDrawer'
import { CountdownOverlay } from '@/components/running/CountdownOverlay'
import { StartRunOverlay } from '@/components/citylord/start/StartRunPageClient'
import { MyRoutesSheet } from '@/components/citylord/map/MyRoutesSheet'
// OneSignal removed
import { isNativePlatform, safeRequestGeolocationPermission, safeRequestLocalNotificationPermission, safeScheduleLocalNotification, safeAMapGetRomInfo, safeAMapIsBatteryOptimizationIgnored } from '@/lib/capacitor/safe-plugins'
import { BatteryOptimizationModal } from '@/components/BatteryOptimizationModal'
import { safeLoadAMap } from '@/lib/map/safe-amap';
import { ImmersiveSkeleton } from '@/components/citylord/running/ImmersiveSkeleton';
import { MapSkeleton } from '@/components/map/MapSkeleton';
import { GameHomePage } from '@/components/citylord/home/GameHomePage';
import type { RunMode } from "@/types/home";
import type { PlannerRoute } from "@/types/route-list";
import { useRouteListStore } from '@/store/useRouteListStore';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/fetch-shim';


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
const MemoizedPlannerClientView = memo(nextDynamic(() => import("@/components/citylord/map/PlannerClientView"), { ssr: false }));
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
const TERRITORY_ALERT_ATTACKER = {
  name: "NightHunter",
  level: 12,
  clan: "暗影军团",
}
const TERRITORY_ALERT_TERRITORY = {
  id: "hex-123",
  name: "中央广场",
  coordinates: "H7-K3",
}
const CHALLENGE_INVITE_CHALLENGER = {
  name: "SpeedRunner",
  level: 15,
  wins: 28,
  clan: "闪电战队",
}
const CHALLENGE_INVITE_DETAIL: {
  type: "distance" | "capture" | "race"
  title: string
  description: string
  duration: string
  reward: number
  location?: string
} = {
  type: "race",
  title: "3公里竞速赛",
  description: "比拼谁能更快完成3公里跑步",
  duration: "30分钟",
  reward: 200,
  location: "中央公园",
}

export function GameLayout({
  initialMissions = [],
  initialStats,
  initialFactionStats,
  initialBadges = [],
  initialFriends = [],
  initialFriendRequests = [],
  initialUser
}: GamePageContentProps) {
  const [searchParams] = useSearchParams()
  const { user, loading: isAuthLoading } = useAuth(initialUser)
  const isAuthenticated = useStore((state) => state.isAuthenticated)
  const isHydrating = useStore((state) => state.isHydrating)
  const { isLoading: isCityLoading, currentCity } = useCity()
  const { checkStaminaRecovery, dismissGeolocationPrompt, claimAchievement, addTotalDistance, openDrawer, closeDrawer, startRunning, stopRunning } = useGameActions()
  const { achievements, totalDistance } = useGameUser()
  const { initializeLocationSystem, setStartWarmupActive, clearWarmupState, resumeHighFreqPrewarm } = useLocationContext()
  const hydrated = useHydration();
  const prefersReducedMotion = useReducedMotion();
  const mapViewRef = useRef<AMapViewHandle>(null);
  const [showTerritory, setShowTerritory] = useState(true);
  const [viewportKing, setViewportKing] = useState<ViewportKingData | null>(null);
  const hasAttemptedFirstInit = useRef(false);
  const queryClient = useQueryClient()
  const lastAuthUserIdRef = useRef<string | null>(user?.id ?? null)

  // 全屏加载状�?- 必须在所�?hooks 之后 return
  // Feature: 页面缓存 �?优先 URL 参数(深度链接) > localStorage 缓存 > 默认 "play"
  const location = useLocation();
  const navigate = useNavigate();
  const rawTab = location.pathname.split('/')[1] || 'home';
  const activeTab = (rawTab === 'map' ? 'play' : rawTab) as TabType;
  const setActiveTab = useCallback((tab: string) => { navigate(`/${tab === 'play' ? 'map' : tab}`); }, [navigate]);

  // [Leaderboard CTA] 监听排行榜空状�?CTA 跳转事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tab: TabType };
      if (detail?.tab && VALID_TABS.includes(detail.tab)) {
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener("citylord:switch-tab", handler);
    return () => window.removeEventListener("citylord:switch-tab", handler);
  }, []);

  // [Anti-Crash] Android 14+ 定位系统受控初始�?
  // 仅在注水完成 + 用户登录 + 页面可见时触�?
  useEffect(() => {
    if (hydrated && isAuthenticated && document.visibilityState === 'visible') {
      const isFirstTime = !hasAttemptedFirstInit.current;
      console.log(`[GamePageContent] Conditions met, initializing location system (isFirstTime: ${isFirstTime})...`);
      
      // [NEW] 只有首次进入 App 时，才允许弹出系统定位权限框 (onlyIfGranted: false)
      // 后续返回、切�?Visible 场景均保持静默检�?
      initializeLocationSystem({ onlyIfGranted: !isFirstTime }).catch((err: any) => {
        console.error('[GamePageContent] Failed to initialize location system:', err);
      });
      
      hasAttemptedFirstInit.current = true;
    }

    // 监听切回前台，确保即便首次启动时被系统阻断，回到 App 后仍能再次激�?
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && hydrated && isAuthenticated) {
        // 切回前台场景，坚持静默检查，不主动弹出打�?
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

  // P0-4: Achievement Queue helpers (must be declared before the mount effect that uses them)
  const ACHIEVEMENT_QUEUE_KEY = 'achievement_pending_queue';

  const processAchievementQueue = useCallback(async () => {
    if (isShowingAchievementRef.current) return;
    if (achievementQueueRef.current.length === 0) {
      // Try to load from Preferences
      try {
        const { Preferences } = await import('@capacitor/preferences');
        const res = await Preferences.get({ key: ACHIEVEMENT_QUEUE_KEY });
        if (res.value) {
          achievementQueueRef.current = JSON.parse(res.value);
        }
      } catch {
        // Ignore
      }
    }

    if (achievementQueueRef.current.length === 0) return;

    const nextId = achievementQueueRef.current.shift();
    // Persist updated queue
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({
        key: ACHIEVEMENT_QUEUE_KEY,
        value: JSON.stringify(achievementQueueRef.current),
      });
    } catch {
      // Ignore
    }

    if (!nextId) return;

    const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === nextId);
    if (def) {
      isShowingAchievementRef.current = true;
      setCurrentUnlockedAchievement(def);
      setShowAchievement(true);
    }
  }, []);

  const enqueueAchievement = useCallback(async (achievementId: string) => {
    achievementQueueRef.current.push(achievementId);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({
        key: ACHIEVEMENT_QUEUE_KEY,
        value: JSON.stringify(achievementQueueRef.current),
      });
    } catch {
      // Ignore
    }
    // Try to show immediately if not already showing
    processAchievementQueue();
  }, [processAchievementQueue]);

  // P0-4: On mount, process any pending achievements from the persistent queue
  useEffect(() => {
    const timer = setTimeout(() => {
      processAchievementQueue();
    }, 1000); // Delay 1s to avoid interfering with initial page load
    return () => clearTimeout(timer);
  }, [processAchievementQueue]);

  // Realtime Battle Alerts
  // ⚠️ DESIGN NOTE: 这里订阅 notifications 表是有意的双通道设计�?
  // 本处负责：触发本地通知 (Native) / Toast (Web)
  // notification-center.tsx (NotificationProvider) 负责：更新通知列表 UI
  // 两者监听同一张表但处理不同的 UI 反馈，请勿合并或删除�?
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
  const trackerValue = useRunningTracker(isRunning, user?.id)
  const {
    distance,
    pace,
    duration,
    calories,
    currentLocation,
    path,
    displayPath,
    closedPolygons,
    sessionClaims, // NEW: Claimed polygons for rendering
    isPaused: trackerIsPaused,
    togglePause: toggleTrackerPause,
    stop: stopTracker,
    clearRecovery,
    finalize,
    addManualLocation,
    setAnchorPoint,
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
    lastAnnouncedKm,
    recoverUnfinishedSession,
  } = trackerValue

  // Crash Recovery Check
  const [hasCheckedRecovery, setHasCheckedRecovery] = useState(false);

  useEffect(() => {
    if (hasCheckedRecovery) return;
    setHasCheckedRecovery(true);

    const checkRecovery = async () => {
      try {
        const data = await recoverUnfinishedSession();
        if (data) {
          console.log("[Recovery] Valid session recovered, restoring UI...", data.runId);
          setIsRunning(true);
          startRunning();
          setShowImmersiveMode(true);
          setActiveTab('play'); 
        }
      } catch (e) {
        console.warn("[Recovery] Failed to recover unfinished session:", e);
      }
    };

    checkRecovery();
  }, [hasCheckedRecovery, startRunning, recoverUnfinishedSession]);

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
  const achievementQueueRef = useRef<string[]>([]); // P0-4: pending achievement IDs
  const isShowingAchievementRef = useRef(false); // P0-4: lock to prevent concurrent popups

  // New onboarding states
  const [showWelcome, setShowWelcome] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [showQuickNav, setShowQuickNav] = useState(false)
  const [showMapGuide, setShowMapGuide] = useState(false)
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [plannerReturnTab, setPlannerReturnTab] = useState<TabType>('home');
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false)
  const [hasResolvedOnboarding, setHasResolvedOnboarding] = useState(false)
  const [shouldHideButtons, setShouldHideButtons] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);

  useEffect(() => {
    const shouldUseWarmupMode = activeTab === "start" || isCountingDown || isRunning

    const syncWarmupMode = async () => {
      try {
        await setStartWarmupActive(shouldUseWarmupMode)
      } catch (err) {
        console.warn('[GamePageContent] Failed to sync warmup mode:', err)
      }
    }

    syncWarmupMode()
  }, [activeTab, isCountingDown, isRunning, setStartWarmupActive])

  // Animation demo states
  const [showCaptureEffect, setShowCaptureEffect] = useState(false)
  const [capturePosition, setCapturePosition] = useState({ x: 200, y: 300 })

  // Error/feedback states
  // GPS weak popup state removed per user request
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [gpsStrength, setGpsStrength] = useState(5)

  // Get user location from store - use stable selectors to avoid unnecessary re-renders
  const userLat = useGameStore((state) => state.latitude)
  const userLng = useGameStore((state) => state.longitude)
  const gameMode = useGameStore((state) => state.gameMode);
  const gpsStatus = useGameStore((state) => state.gpsStatus);
  const gpsError = useGameStore((state) => state.gpsError);
  const activeDrawer = useGameStore((state) => state.activeDrawer);
  const hasDismissedGeolocationPrompt = useGameStore((state) => state.hasDismissedGeolocationPrompt);
  const ghostPath = useGameStore((state) => state.ghostPath);
  const setGhostPath = useGameStore((state) => state.setGhostPath);
  const isRouteListOpen = useRouteListStore((state) => state.isOpen);
  const openRouteList = useRouteListStore((state) => state.openRouteList);
  const closeRouteList = useRouteListStore((state) => state.closeRouteList);
  const setSelectedRoute = useRouteListStore((state) => state.setSelectedRoute);
  const liveLocation = useLocationStore((state) => state.location);
  const locationSignalStrength = useLocationStore((state) => state.gpsSignalStrength);
  const isRunTakeoverActive = isCountingDown || isImmersiveActive
  const shouldRenderPlaySurface = activeTab === "home" || activeTab === "play" || activeTab === "start" || isRunTakeoverActive
  const shouldShowPlayChrome = activeTab === "play" && !isRunTakeoverActive
  const immersiveCurrentLocation = useMemo(
    () => currentLocation || (userLat && userLng ? { lat: userLat, lng: userLng } : undefined),
    [currentLocation, userLat, userLng]
  )

  // Check if first visit - 只在首次挂载时执�?
  useEffect(() => {
    let isMounted = true

    // OneSignal removed

    async function checkSession() {
      // If we have initialUser from server, we can skip some checks or just verify
      if (initialUser) {
        return
      }

      console.log('[Page] Checking session...')
      // 检�?Supabase Session
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
    const res = await apiFetch(`/api/social/friends`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch friends')
    return res.json()
  })

  useEffect(() => {
    if (isAuthLoading) return
    const nextUserId = user?.id ?? null
    if (lastAuthUserIdRef.current === nextUserId) return
    lastAuthUserIdRef.current = nextUserId
    queryClient.removeQueries({ queryKey: ['territory-detail'] })
    queryClient.invalidateQueries({ queryKey: ['cityStats'] })
    queryClient.invalidateQueries({ queryKey: ['cityLeaderboard'] })
    queryClient.invalidateQueries({ queryKey: ['userCityProgress'] })
    mutateSWR(
      (key: unknown) => {
        if (typeof key !== 'string') return false
        return key.includes('/api/v1/territories') || key.includes('/api/territory/list') || key === 'friends'
      },
      undefined,
      { revalidate: true }
    ).catch(() => {})
    window.dispatchEvent(new Event('citylord:refresh-territories'))
  }, [isAuthLoading, queryClient, user?.id])

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

  const beginRunStart = useCallback(async (forceSkipCheck = false) => {
    if (!isAuthenticated) {
      toast.warning('请先登录才能开始占领领地！')
      return false
    }

    const nextLat = liveLocation?.lat ?? immersiveCurrentLocation?.lat
    const nextLng = liveLocation?.lng ?? immersiveCurrentLocation?.lng
    const isGpsFailed = gpsStatus === 'error' || gpsError === 'PERMISSION_DENIED'
    const isMissingLocation = !Number.isFinite(nextLat) || !Number.isFinite(nextLng)

    if (isGpsFailed || isMissingLocation) {
      toast.error('定位不准或定位失败，请检查设备定位设置或移动到开阔地�?)
      return false
    }

    // 真机激进省电策略厂商拦截检�?
    if (!forceSkipCheck) {
      const native = await isNativePlatform();
      if (native) {
        const romInfo = await safeAMapGetRomInfo();
        const isAggressive = romInfo?.isAggressive ?? false;
        const isIgnored = await safeAMapIsBatteryOptimizationIgnored();
        const skipped = useLocationStore.getState().batteryOptSkipped;

        if (isAggressive && !isIgnored && !skipped) {
          // 拦截起跑并唤起弹�?
          useLocationStore.getState().setBatteryOptModalVisible(true);
          return false;
        }
      }
    }

    setActiveTab("play")
    finalize()
    startCountdown()
    return true
  }, [gpsError, gpsStatus, immersiveCurrentLocation, isAuthenticated, liveLocation, startCountdown, finalize])

  const handleQuickNavigate = useCallback((tab: string, options?: { initialFilter?: 'all' | 'daily' | 'weekly' }) => {
    if (options?.initialFilter) {
      setMissionsInitialFilter(options.initialFilter);
    }

    if (tab === "running") {
      setActiveTab("start")
    } else if (tab === "planner") {
      setPlannerReturnTab(activeTab)
      setIsPlannerOpen(true)
    } else {
      setActiveTab(tab as TabType)
    }
  }, [activeTab])

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

        toast.info("请在浏览器设置中开启定位权�?);
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
    setPlannerReturnTab(activeTab)
    setIsPlannerOpen(true)
  }, [activeTab]);

  const handlePlannerClose = useCallback(() => {
    setIsPlannerOpen(false)
    setActiveTab(plannerReturnTab)
  }, [plannerReturnTab])

  const handleRunHistoryOpen = useCallback(() => {
    openDrawer('runHistory');
  }, [openDrawer]);

  const handleLeaderboardOpen = useCallback(() => {
    openDrawer('leaderboard');
  }, [openDrawer]);

  const handleRouteListOpen = useCallback(() => {
    openRouteList('game')
  }, [openRouteList])

  const handleRouteEdit = useCallback((route: PlannerRoute) => {
    if (activeTab === "start") {
      setSelectedRoute(route)
      closeRouteList()
      return
    }
    setSelectedRoute(route)
    setGhostPath(route.waypoints.map((point) => [point.lat, point.lng] as [number, number]))
    if (!isPlannerOpen) {
      setPlannerReturnTab(activeTab)
      setIsPlannerOpen(true)
    }
    closeRouteList()
  }, [activeTab, closeRouteList, isPlannerOpen, setGhostPath, setSelectedRoute])

  const handleRouteStartRun = useCallback((route: PlannerRoute) => {
    setGhostPath(route.waypoints.map((point) => [point.lat, point.lng] as [number, number]))
    closeRouteList()
    setActiveTab("start")
  }, [closeRouteList, setGhostPath])

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
      claimAchievement(currentUnlockedAchievement.id)
    } else {
      claimAchievement('marathon-hero')
    }
    setShowAchievement(false);
    isShowingAchievementRef.current = false;
    // P0-4: Process next achievement in queue after current one is dismissed
    setTimeout(() => processAchievementQueue(), 300);
  }, [currentUnlockedAchievement, claimAchievement]);

  // Share achievement �?Web Share API �?Clipboard fallback
  const handleShareAchievement = useCallback(async () => {
    const fallbackDef = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'marathon-hero');
    const achievement = currentUnlockedAchievement || fallbackDef;
    if (!achievement) return;
    
    const shareText = `我在城市领主解锁了成就�?{achievement.title}」！${achievement.description}`;

    // Try native Web Share API first (works on mobile browsers + Capacitor WebView)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '解锁成就 �?城市领主',
          text: shareText,
        });
        toast.success('分享成功');
        return;
      } catch (err: any) {
        // User cancelled share or unsupported �?fall through to clipboard
        if (err?.name !== 'AbortError') {
          console.warn('[Achievement] Web Share failed, falling back to clipboard:', err);
        }
      }
    }

    // Fallback: copy to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        toast.success('成就信息已复制到剪贴�?);
      } else {
        // Legacy fallback for non-secure contexts
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        toast.success('成就信息已复制到剪贴�?);
      }
    } catch (clipErr) {
      console.error('[Achievement] Clipboard copy failed:', clipErr);
      toast.error('分享失败，请截图手动分享');
    }
  }, [currentUnlockedAchievement]);

  // GPS retry handler removed per user request

  const handleHexClaimed = useCallback(() => {
    setSessionHexes(prev => prev + 1)
    setShowCaptureEffect(true)
  }, []);

  const handleCountdownComplete = useCallback((anchorPoint?: import('@/hooks/useSafeGeolocation').GeoPoint) => {
    setIsCountingDown(false)
    clearWarmupState()
    setIsRunning(true)
    startRunning()
    setShowImmersiveMode(true)
    setActiveTab("play")

    // 全生命周期预热：接收黄金起点，立即熔�?warmup 状�?
    if (anchorPoint && typeof anchorPoint.lat === 'number' && typeof anchorPoint.lng === 'number') {
      console.log('[SmartPrewarm] Using converged anchor:', anchorPoint.lat.toFixed(6), anchorPoint.lng.toFixed(6), 'accuracy:', anchorPoint.accuracy)
      setAnchorPoint(anchorPoint)
      // 通知原生层恢复高频定�?
      resumeHighFreqPrewarm()
    }
  }, [clearWarmupState, startRunning, setAnchorPoint, resumeHighFreqPrewarm]);

  // Complex stop handler
  const handleStopRun = useCallback(async () => {
    stopTracker()
    stopRunning()
    clearRecovery()
    setIsCountingDown(false)
    setIsRunning(false)
    setShowImmersiveMode(false)
    setGhostPath(null)
    setActiveTab("home")

    const currentRunDistance = distance || 0
    addTotalDistance(currentRunDistance)

    // Explicitly clear recovery key again to be safe
    if (typeof window !== 'undefined') {
      localStorage.removeItem('CURRENT_RUN_RECOVERY');
    }

    // Lock UI with loading toast to prevent duplicate clicks
    const settleToastId = 'settle-run';
    toast.loading('正在结算跑步数据...', { id: settleToastId });

    const runEndTime = new Date().toISOString();
    const rawPace = currentRunDistance > 0 ? durationSeconds / (currentRunDistance / 1000) : undefined;
    const payload = {
      distance: currentRunDistance,
      duration: durationSeconds || 0,
      pace: rawPace,
      endTime: runEndTime,
    };

    try {
      const result = await checkRunEndAchievements(payload);

      if (result.success && result.awarded && result.awarded.length > 0) {
        // P0-4: Enqueue achievements via persistent queue instead of direct setState
        for (const awarded of result.awarded) {
          if (awarded.badgeCode) {
            await enqueueAchievement(awarded.badgeCode);
          }
        }
      }

      toast.success('跑步数据已结�?, { id: settleToastId });
    } catch (err) {
      console.error('[handleStopRun] Achievement check failed:', err);

      // Offline fallback: persist to local queue for later sync
      try {
        const offlineQueueJson = typeof window !== 'undefined'
          ? localStorage.getItem('pending_offline_runs')
          : null;
        const offlineQueue: typeof payload[] = offlineQueueJson
          ? JSON.parse(offlineQueueJson)
          : [];
        offlineQueue.push(payload);
        if (offlineQueue.length > 50) {
          offlineQueue.splice(0, offlineQueue.length - 50);
        }
        localStorage.setItem('pending_offline_runs', JSON.stringify(offlineQueue));
      } catch (storeErr) {
        console.error('[handleStopRun] Failed to persist offline run:', storeErr);
      }

      toast.error('网络异常，本次数据已存入本地，将在下次联网时自动结算', {
        id: settleToastId,
        duration: 5000,
      });
    }
  }, [distance, durationSeconds, pace, stopTracker, stopRunning, clearRecovery, addTotalDistance, setGhostPath]);

  const handleMapLoad = useCallback(() => { }, []);

  const handleExpand = useCallback(() => { }, []);
  const handleTrackerPause = useCallback(() => {
    toggleTrackerPause()
  }, [toggleTrackerPause])
  const handleManualLocationUpdate = useCallback((lat: number, lng: number) => {
    addManualLocation(lat, lng)
  }, [addManualLocation])
  const fallbackAchievement = useMemo(() => ({
    id: "marathon-hero",
    title: "马拉松英�?,
    description: "累计跑步距离达到42.195公里，你已成为真正的长跑者！",
    icon: "🏅",
    rarity: "epic",
    unlockedAt: new Date().toLocaleDateString('zh-CN'),
  }), [])

  const contextValue = useMemo(() => ({
    ...trackerValue,
    isRunning,
    isRunTakeoverActive,
    activeTab,
    setActiveTab,
    immersiveCurrentLocation,
    sessionHexes,
    handleTrackerPause,
    handleStopRun,
    handleManualLocationUpdate,
    handleExpand,
    handleHexClaimed,
    beginRunStart,
    handlePlannerOpen,
  }), [
    trackerValue,
    isRunning,
    isRunTakeoverActive,
    activeTab,
    setActiveTab,
    immersiveCurrentLocation,
    sessionHexes,
    handleTrackerPause,
    handleStopRun,
    handleManualLocationUpdate,
    handleExpand,
    handleHexClaimed,
    beginRunStart,
    handlePlannerOpen,
  ]);

  return (
    <RunningTrackerContext.Provider value={contextValue}>
    <div className="relative w-full h-[100dvh] max-w-md mx-auto bg-[#0f172a] overflow-hidden flex flex-col">
      {!hydrated && <LoadingScreen message="正在初始�?.." />}
      {!currentCity && hydrated && <LoadingScreen message="正在加载城市数据..." />}

      <WelcomeScreen
        isOpen={showWelcome}
        onComplete={handleWelcomeComplete}
        userName="跑�?
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

      <MyRoutesSheet
        open={isRouteListOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeRouteList()
          }
        }}
        onEdit={handleRouteEdit}
        onStartRun={handleRouteStartRun}
      />

      {isPlannerOpen && (
        <div className="absolute inset-0 z-[9999]">
          <MemoizedPlannerClientView onClose={handlePlannerClose} />
        </div>
      )}

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
                {isAuthenticated ? (
                  <>
                    <MemoizedAMapView
                      ref={mapViewRef}
                      showTerritory={showTerritory && activeTab !== "start"}
                      showControls={shouldShowPlayChrome}
                      onMapLoad={handleMapLoad}
                      sessionClaims={sessionClaims}
                      runPath={isRunTakeoverActive ? displayPath : undefined}
                      path={isRunTakeoverActive ? path : undefined}
                      ghostPath={ghostPath}
                      onViewportKingChange={setViewportKing}
                      isRunTakeoverActive={isRunTakeoverActive}
                    >
                      {shouldShowPlayChrome && (
                        <div className="pointer-events-auto">
                          <MemoizedMapHeader setShowThemeSwitcher={setShowThemeSwitcher} isRunTakeoverActive={isRunTakeoverActive} />
                        </div>
                      )}
                    </MemoizedAMapView>
                    {shouldShowPlayChrome && <MemoizedFactionSelector initialUser={initialUser} />}
                    {shouldShowPlayChrome && <MemoizedReferralWelcome />}
                  </>
                ) : (
                  <div className="absolute inset-0 z-50 bg-[#020617] pointer-events-auto" />
                )}
              </div>

              <div className="relative z-10 h-full w-full pointer-events-none">
                {shouldShowPlayChrome && (
                  <>
                    <div className="pointer-events-auto">
                      <MemoizedModeSwitcher onDrawerOpenChange={handleDrawerOpenChange} king={gameMode === 'map' ? viewportKing : null} />
                    </div>

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
                            onClick={handlePlannerOpen}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground"
                            aria-label="智能规划"
                          >
                            <Route className="h-5 w-5" />
                          </button>
                          <span className="absolute left-12 pointer-events-none opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10">智能规划</span>
                        </div>

                        <div className="group relative flex items-center">
                          <button
                            onClick={handleRouteListOpen}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground"
                            aria-label="我的路线"
                          >
                            <List className="h-5 w-5" />
                          </button>
                          <span className="absolute left-12 pointer-events-none opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10">我的路线</span>
                        </div>

                        <div className="group relative flex items-center">
                          <button
                            onClick={handleLeaderboardOpen}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-90 active:bg-white/20 transition-all hover:bg-primary/20 hover:border-primary/50 hover:text-primary-foreground"
                          >
                            <Trophy className="h-5 w-5" />
                          </button>
                          <span className="absolute left-12 pointer-events-none opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity whitespace-nowrap bg-black/80 text-white text-[10px] sm:text-xs px-2 py-1 rounded border border-white/10">查看排行�?/span>
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
            <div className="absolute inset-0 bg-[#0f172a] z-40 overflow-y-auto">
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
              {isAuthenticated ? (
                <MemoizedAMapView ref={mapViewRef} showTerritory={showTerritory} showControls={shouldShowPlayChrome} sessionClaims={sessionClaims} runPath={isRunTakeoverActive ? displayPath : undefined} path={isRunTakeoverActive ? path : undefined} ghostPath={ghostPath} isRunTakeoverActive={isRunTakeoverActive}>
                  <div className="pointer-events-auto">
                    <MemoizedMapHeader
                      setShowThemeSwitcher={setShowThemeSwitcher}
                      isRunTakeoverActive={isRunTakeoverActive}
                    />
                  </div>
                </MemoizedAMapView>
              ) : (
                <div className="absolute inset-0 z-50 bg-[#020617] pointer-events-auto" />
              )}
              <div className="relative z-10 h-full w-full pointer-events-none">
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
      ) : isRunTakeoverActive ? (
        <div className="absolute inset-0 z-[9999] pointer-events-none">
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
            initialIsPaused={trackerIsPaused}
            onPause={handleTrackerPause}
            onResume={handleTrackerPause}
            onStop={handleStopRun}
            onManualLocation={handleManualLocationUpdate}
            onExpand={handleExpand}
            currentLocation={immersiveCurrentLocation}
            path={path}
            displayPath={displayPath}
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
            finalize={finalize}
            clearRecovery={clearRecovery}
            lastAnnouncedKm={lastAnnouncedKm}
          />
        </div>
      ) : null}

      {hydrated && currentCity && !isRunTakeoverActive && activeTab !== "start" && <MemoizedBottomNav activeTab={activeTab} onTabChange={setActiveTab} />}

      <MemoizedTerritoryAlert
        isOpen={showTerritoryAlert}
        onClose={() => setShowTerritoryAlert(false)}
        attacker={TERRITORY_ALERT_ATTACKER}
        territory={TERRITORY_ALERT_TERRITORY}
        timeAgo="2分钟�?
        onCounterAttack={handleCounterAttack}
        onViewMap={handleViewMap}
      />

      <MemoizedChallengeInvite
        isOpen={showChallengeInvite}
        onClose={() => setShowChallengeInvite(false)}
        challenger={CHALLENGE_INVITE_CHALLENGER}
        challenge={CHALLENGE_INVITE_DETAIL}
        onAccept={handleAcceptChallenge}
      />

      <MemoizedAchievementPopup
        isOpen={showAchievement}
        onClose={() => setShowAchievement(false)}
        achievement={currentUnlockedAchievement || fallbackAchievement}
        rewards={currentUnlockedAchievement ? [
          currentUnlockedAchievement.rewards.xp && { type: "xp", amount: currentUnlockedAchievement.rewards.xp, label: "经验�? },
          currentUnlockedAchievement.rewards.coins && { type: "coins", amount: currentUnlockedAchievement.rewards.coins, label: "金币" },
          currentUnlockedAchievement.rewards.badge && { type: "badge", amount: 1, label: "专属徽章" },
          currentUnlockedAchievement.rewards.title && { type: "title", amount: 1, label: "专属称号" },
        ].filter(Boolean) : [
          { type: "xp", amount: 500, label: "经验�? },
          { type: "coins", amount: 200, label: "金币" },
          { type: "badge", amount: 1, label: "专属徽章" },
        ]}
        onClaim={handleClaimAchievement}
        onShare={handleShareAchievement}
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

      <BatteryOptimizationModal
        onConfirm={() => {
          beginRunStart(true);
        }}
        onSkip={() => {
          useLocationStore.getState().setBatteryOptSkipped(true);
          beginRunStart(true);
        }}
      />
    </div>
    </RunningTrackerContext.Provider>
  )
}

"use client"

import nextDynamic from 'next/dynamic';
import { useState, useEffect, useRef } from "react"
import { BottomNav, TabType } from "@/components/citylord/bottom-nav"
import { MissionCenter } from "@/components/citylord/MissionCenter"
import { Leaderboard } from "@/components/citylord/leaderboard"
import { Profile } from "@/components/citylord/profile"
import { LeaderboardFilter } from "@/components/citylord/leaderboard-filter"
import { OnboardingGuide } from "@/components/citylord/onboarding-guide"
import { QuickEntry } from "@/components/citylord/quick-entry"
import { TerritoryAlert } from "@/components/citylord/territory-alert"
import { ChallengeInvite } from "@/components/citylord/challenge-invite"
import { AchievementPopup } from "@/components/citylord/achievement-popup"
import { SocialPage } from "@/components/citylord/social/social-page"
import { NotificationProvider, NotificationPanel, sampleNotifications } from "@/components/citylord/notifications/notification-center"
import { WelcomeScreen, InteractiveTutorial, QuickNavPopup, MapInteractionGuide } from "@/components/citylord/onboarding/complete-onboarding"
import { MapHeader } from "@/components/map/MapHeader"
import { NavBar } from "@/components/citylord/NavBar"
import { LoadingScreen } from "@/components/citylord/loading-screen"
import { useRunningTracker } from "@/hooks/useRunningTracker"
import useSWR from 'swr'
import { fetchFriends } from "@/app/actions/social"

const ImmersiveRunningMode = nextDynamic(() => import("@/components/citylord/running/immersive-mode").then(mod => mod.ImmersiveRunningMode), { ssr: false });

import { useCity } from "@/contexts/CityContext"
import {
  GpsWeakPopup,
  NetworkBanner,
  LocationPermissionPrompt,
} from "@/components/citylord/feedback/error-feedback"
import { useGameStore, useGameActions, useGameUser } from "@/store/useGameStore";
import { useHydration } from "@/hooks/useHydration";
import { ThemeSwitcher } from "@/components/citylord/theme/theme-provider";
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { SinglePlayer } from '@/components/mode/SinglePlayer';
import { PrivateLobby } from '@/components/mode/PrivateLobby';
import { MyClub } from '@/components/mode/MyClub';

import { AMapViewHandle } from "@/components/map/AMapView";

const AMapView = nextDynamic(() => import("@/components/map/AMapViewWithProvider").then(mod => mod.AMapViewWithProvider), { ssr: false });

import { FactionSelector } from "@/components/social/FactionSelector"
import { ReferralWelcome } from "@/components/social/ReferralWelcome"
import { useSearchParams, useRouter } from 'next/navigation'
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { toast } from "sonner"

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { RunHistoryDrawer } from "@/components/map/RunHistoryDrawer"
import { History, Pen } from "lucide-react"
import { CountdownOverlay } from "@/components/running/CountdownOverlay"
import { initOneSignal, setExternalUserId } from "@/lib/onesignal/init"
import { LocalNotifications } from '@capacitor/local-notifications'

interface GamePageContentProps {
  initialMissions?: any[]
  initialStats?: any
  initialFactionStats?: any
  initialBadges?: any[]
  initialFriends?: any[]
  initialFriendRequests?: any[]
  initialUser?: any
}

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
  const { user, isAuthenticated } = useAuth(initialUser)
  const { isLoading: isCityLoading, currentCity } = useCity()
  const { checkStaminaRecovery, dismissGeolocationPrompt, claimAchievement, addTotalDistance } = useGameActions()
  const { achievements, totalDistance } = useGameUser()
  const hydrated = useHydration();
  const mapViewRef = useRef<AMapViewHandle>(null);
  const [showTerritory, setShowTerritory] = useState(true);

  // 全屏加载状态 - 必须在所有 hooks 之后 return
  const [activeTab, setActiveTab] = useState<TabType>("play")

  // State Persistence for Tabs
  useEffect(() => {
    // On mount, check URL param
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab && ['play', 'missions', 'social', 'profile', 'leaderboard', 'mode'].includes(tab)) {
            setActiveTab(tab as TabType);
        }
    }
  }, []);

  // Sync state to URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
    }
  }, [activeTab]);

  // Realtime Battle Alerts
  useEffect(() => {
    if (!user?.id) return;
    
    // Request Local Notification Permissions
    const requestPermissions = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                await LocalNotifications.requestPermissions();
            }
        } catch (e) {
            console.error("Failed to request notification permissions", e);
        }
    };
    requestPermissions();

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
             if (Capacitor.isNativePlatform()) {
                 try {
                     await LocalNotifications.schedule({
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
             } catch(e) {}
          }
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); }
  }, [user?.id]);

  // Mission Count
  const [missionCount, setMissionCount] = useState(0)

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

  // Running Tracker
  const { 
    distance, 
    pace, 
    duration, 
    calories, 
    currentLocation, 
    path,
    closedPolygons,
    togglePause: toggleTrackerPause, 
    stop: stopTracker,
    clearRecovery,
    addManualLocation
  } = useRunningTracker(isRunning)

  // Crash Recovery Check
  useEffect(() => {
      const RECOVERY_KEY = 'CURRENT_RUN_RECOVERY';
      const recoveryJson = localStorage.getItem(RECOVERY_KEY);
      if (recoveryJson) {
          try {
              const data = JSON.parse(recoveryJson);
              // Check 24h validity
              if (data.startTime && (Date.now() - data.startTime < 24 * 60 * 60 * 1000)) {
                  console.log("Found crash recovery data, restoring run...");
                  setIsRunning(true);
                  setShowImmersiveMode(true);
              } else {
                  localStorage.removeItem(RECOVERY_KEY);
              }
          } catch (e) {
              localStorage.removeItem(RECOVERY_KEY);
          }
      }
  }, []);

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
  const [isCityDrawerOpen, setIsCityDrawerOpen] = useState(false);
  const [isRunHistoryOpen, setIsRunHistoryOpen] = useState(false);
  const [shouldHideButtons, setShouldHideButtons] = useState(false);
  const [isCountingDown, setIsCountingDown] = useState(false);

  // Animation demo states
  const [showCaptureEffect, setShowCaptureEffect] = useState(false)
  const [capturePosition, setCapturePosition] = useState({ x: 200, y: 300 })

  // Error/feedback states
  const [showGpsWeakPopup, setShowGpsWeakPopup] = useState(false)
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
  const hasDismissedGeolocationPrompt = useGameStore((state) => state.hasDismissedGeolocationPrompt);
  const isSmartRunStarting = useGameStore((state) => state.isSmartRunStarting);
  const setSmartRunStarting = useGameStore((state) => state.setSmartRunStarting);
  
  // Smart Run Start Listener
  useEffect(() => {
    if (isSmartRunStarting) {
        setIsRunning(true);
        setShowImmersiveMode(true);
        setSmartRunStarting(false);
    }
  }, [isSmartRunStarting, setSmartRunStarting]);
  
  // Check if first visit - 只在首次挂载时执行
  useEffect(() => {
    let isMounted = true
    
    // Initialize OneSignal
    initOneSignal();
    
    async function checkSession() {
      // If we have initialUser from server, we can skip some checks or just verify
      if (initialUser) {
        // Logged in
        setExternalUserId(initialUser.id);
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
         if (isMounted) setShowWelcome(false)

         const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
             if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
                 if (isMounted) setShowWelcome(false)
                 if (window.history.replaceState) {
                    window.history.replaceState(null, '', window.location.pathname);
                 }
             }
         })
         
         setTimeout(() => {
             if (isMounted) {
                 supabase.auth.getSession().then(({ data: { session } }) => {
                     if (session) {
                         setShowWelcome(false)
                         if (window.history.replaceState && window.location.hash.includes('access_token')) {
                            window.history.replaceState(null, '', window.location.pathname);
                         }
                     } else {
                         const hasVisited = localStorage.getItem('hasVisited')
                         if (!hasVisited) {
                             setShowWelcome(true)
                             localStorage.setItem('hasVisited', 'true')
                         }
                     }
                 })
             }
         }, 3000)
         
         return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session) {
        setShowWelcome(false)
        if (session.user?.id) setExternalUserId(session.user.id);
        return
      }

      const hasVisited = localStorage.getItem('hasVisited')
      
      if (!hasVisited) {
        setShowWelcome(true)
        localStorage.setItem('hasVisited', 'true')
      }
    }

    checkSession()
    
    return () => { isMounted = false }
  }, [initialUser])

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
      checkStaminaRecovery()
    }, 60000)
    return () => clearInterval(interval)
  }, [checkStaminaRecovery])

  const { data: friends } = useSWR('friends', fetchFriends)

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    setShowOnboarding(true)
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  // Countdown Audio Ref
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleQuickNavigate = (tab: "missions" | "social" | "running") => {
    if (tab === "running") {
      if (!isAuthenticated) {
        toast.warning('请先登录才能开始占领领地！')
        // Only redirect if explicitly required, otherwise just warn
        // router.push('/login')
        return
      }

      // Force Play Audio immediately on user interaction
      console.log('Attempting to play: countdown.mp3');
      const audio = new Audio('/sounds/countdown.mp3');
      audio.volume = 0.8;
      audio.play().catch(e => console.error("Play failed", e));
      countdownAudioRef.current = audio;

      // Show overlay
      setIsCountingDown(true)
      
      // Auto-complete handled by CountdownOverlay internal logic now (synced with visual)
      // We removed the timeout here to avoid conflict


    } else {
      setActiveTab(tab as TabType)
    }
  }

  const handleShowDemo = (type: "territory" | "challenge" | "achievement") => {
    if (type === "territory") setShowTerritoryAlert(true)
    if (type === "challenge") setShowChallengeInvite(true)
    if (type === "achievement") setShowAchievement(true)
  }

  const triggerCaptureEffect = () => {
    setCapturePosition({ 
      x: 100 + Math.random() * 200, 
      y: 200 + Math.random() * 200 
    })
    setShowCaptureEffect(true)
  }

  const handleOpenSettings = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.requestPermissions();
      } else {
        toast.info("请在浏览器设置中开启定位权限");
      }
    } catch (e) {
      console.error("Failed to open settings", e);
      toast.error("无法打开设置");
    }
  };

  return (
    <div className="relative w-full h-[100dvh] max-w-md mx-auto flex flex-col bg-[#0f172a] overflow-hidden">
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
        onClose={() => setShowQuickNav(false)}
        onNavigate={(tab) => setActiveTab(tab as TabType)}
        missionCount={missionCount}
      />

      <MapInteractionGuide
        isOpen={showMapGuide}
        onClose={() => setShowMapGuide(false)}
      />

      <ThemeSwitcher
        isOpen={showThemeSwitcher}
        onClose={() => setShowThemeSwitcher(false)}
      />

      <OnboardingGuide
        isVisible={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      {isCountingDown && (
        <CountdownOverlay
          onComplete={() => {
            setIsCountingDown(false)
            setIsRunning(true)
            setShowImmersiveMode(true)
          }}
        />
      )}

      <LocationPermissionPrompt
        isOpen={hydrated && !!gpsError && !hasDismissedGeolocationPrompt}
        onClose={dismissGeolocationPrompt}
        onOpenSettings={handleOpenSettings}
      />

      {hydrated && currentCity && (
        <main className="relative flex-1 overflow-hidden">
        {activeTab === "play" && (
          <div className="relative h-dvh w-full overflow-hidden">
            <div className="absolute inset-0 z-0">
              <AMapView 
                ref={mapViewRef} 
                showTerritory={showTerritory}
                onMapLoad={() => {}}
              />
              <FactionSelector initialUser={initialUser} />
              <ReferralWelcome />
            </div>

            <div className="relative z-10 h-full w-full pointer-events-none">
              <div className="pointer-events-auto">
                <MapHeader isCityDrawerOpen={isCityDrawerOpen} setIsCityDrawerOpen={setIsCityDrawerOpen} setShowThemeSwitcher={setShowThemeSwitcher} />
              </div>

              <div className="pointer-events-auto mt-[96px]">
                <ModeSwitcher onDrawerOpenChange={(isOpen) => setShouldHideButtons(isOpen)} />
              </div>

              {!shouldHideButtons && (
                <div className="pointer-events-auto absolute top-[130px] left-4 z-20 flex flex-col gap-4">
                  <button
                      onClick={() => router.push('/game/planner')}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-95 transition-all hover:bg-black/80"
                    >
                      <Pen className="h-5 w-5" />
                    </button>

                  <button
                      onClick={() => setIsRunHistoryOpen(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg text-white active:scale-95 transition-all hover:bg-black/80"
                    >
                      <History className="h-5 w-5" />
                    </button>
                </div>
              )}

              {gameMode === 'map' && !shouldHideButtons && (
                <div className="pointer-events-auto absolute bottom-[100px] left-4 right-4 z-20 flex justify-center">
                  <QuickEntry 
                    onNavigate={(tab) => {
                       handleQuickNavigate(tab)
                    }} 
                    missionCount={missionCount} 
                    friendCount={friends?.length || 0} 
                  />
                </div>
              )}
            </div>

            {gameMode !== 'map' && !shouldHideButtons && (
              <div className="pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[calc(100%-2rem)] max-w-md">
                <div className="mx-auto max-h-[70vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl p-6">
                  {gameMode === 'single' && <SinglePlayer />}
                  {gameMode === 'private' && <PrivateLobby />}
                  {gameMode === 'club' && <MyClub hasClub={true} />}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "mode" && (
          <div className="relative h-dvh w-full overflow-hidden">
            <AMapView ref={mapViewRef} showTerritory={showTerritory} viewMode={mapViewMode} />
            <div className="relative z-10 h-full w-full pointer-events-none">
              <div className="pointer-events-auto">
                <MapHeader 
                  isCityDrawerOpen={isCityDrawerOpen} 
                  setIsCityDrawerOpen={setIsCityDrawerOpen} 
                  setShowThemeSwitcher={setShowThemeSwitcher} 
                  viewMode={mapViewMode}
                  onViewModeChange={setMapViewMode}
                />
              </div>
              <div className="pointer-events-auto mt-[96px]">
                <ModeSwitcher onDrawerOpenChange={(isOpen) => setShouldHideButtons(isOpen)} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "missions" && (
          <div className="absolute inset-0 z-40 bg-[#0f172a]">
            <MissionCenter initialData={initialMissions} />
          </div>
        )}

        {activeTab === "leaderboard" && (
          <div id="nav-leaderboard" className="absolute inset-0 z-40 flex h-full flex-col bg-[#0f172a]">
            <div className="border-b border-white/10 px-4 pb-4 pt-6">
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-white">排行榜</h1>
                <p className="text-sm text-white/60">领地占领者排名</p>
              </div>
              <LeaderboardFilter 
                onTimeFilterChange={() => {}} 
                onScopeFilterChange={() => {}}
                onMetricFilterChange={() => {}}
              />
            </div>
            <div className="flex-1 overflow-y-auto pb-24">
              <Leaderboard />
            </div>
          </div>
        )}

        {activeTab === "social" && (
          <div id="nav-social" className="absolute inset-0 z-40 h-full bg-[#0f172a]">
            <SocialPage 
              onShowDemo={handleShowDemo} 
              initialFriends={initialFriends}
              initialRequests={initialFriendRequests}
            />
          </div>
        )}

        {activeTab === "profile" && (
          <div className="absolute inset-0 z-40 h-full bg-[#0f172a]">
            <Profile 
              onOpenSettings={() => setShowThemeSwitcher(true)} 
              initialFactionStats={initialFactionStats}
              initialBadges={initialBadges}
            />
          </div>
        )}
      </main>
      )}

      <ImmersiveRunningMode
        isActive={showImmersiveMode}
        userId={user?.id}
        distance={distance}
        pace={pace}
        time={duration}
        calories={calories}
        heartRate={0}
        hexesCaptured={sessionHexes}
        currentHexProgress={0}
        onPause={toggleTrackerPause}
        onResume={toggleTrackerPause}
        onStop={() => {
          stopTracker()
          clearRecovery()
          setIsRunning(false)
          setShowImmersiveMode(false)
          
          const currentRunDistance = distance || 0
          addTotalDistance(currentRunDistance)
          const newTotalDistance = (totalDistance || 0) + currentRunDistance
          
          if (!achievements?.['endurance_3'] && !localStorage.getItem('achievement_marathon-hero_claimed') && newTotalDistance >= 42195) {
             const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'endurance_3');
             if (def) {
                 setCurrentUnlockedAchievement(def);
                 setShowAchievement(true);
                 return;
             }
          }

          if (!achievements?.['endurance_1'] && newTotalDistance >= 1000) {
             const def = ACHIEVEMENT_DEFINITIONS.find(a => a.id === 'endurance_1');
             if (def) {
                 setCurrentUnlockedAchievement(def);
                 setShowAchievement(true);
             }
          }
        }}
        onManualLocation={addManualLocation}
        onExpand={() => {}}
        currentLocation={currentLocation || undefined}
        path={path}
        closedPolygons={closedPolygons}
        onHexClaimed={() => {
          setSessionHexes(prev => prev + 1)
          setShowCaptureEffect(true)
        }}
      />

      {hydrated && currentCity && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}

      <TerritoryAlert
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
        onCounterAttack={() => {
          setShowTerritoryAlert(false)
          setActiveTab("play")
        }}
        onViewMap={() => {
          setShowTerritoryAlert(false)
          setActiveTab("play")
        }}
      />

      <ChallengeInvite
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
        onAccept={() => {
          setShowChallengeInvite(false)
          setIsCountingDown(true) // Trigger countdown instead of immediate run
          setActiveTab("play")
        }}
      />

      <AchievementPopup
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
        onClaim={() => {
          if (currentUnlockedAchievement) {
            localStorage.setItem(`achievement_${currentUnlockedAchievement.id}_claimed`, 'true')
            claimAchievement(currentUnlockedAchievement.id)
          } else {
            localStorage.setItem('achievement_marathon-hero_claimed', 'true')
            claimAchievement('marathon-hero')
          }
          setShowAchievement(false)
        }}
        onShare={() => {}}
      />

      <NetworkBanner 
        isOffline={isOffline} 
        onRetry={() => setIsOffline(false)} 
      />

      <GpsWeakPopup
        isOpen={showGpsWeakPopup}
        onClose={() => setShowGpsWeakPopup(false)}
        onRetry={() => {
          setGpsStrength(5)
          setShowGpsWeakPopup(false)
        }}
        signalStrength={gpsStrength}
      />

      <LocationPermissionPrompt
        isOpen={showPermissionPrompt}
        onClose={() => setShowPermissionPrompt(false)}
        onOpenSettings={handleOpenSettings}
      />

      <RunHistoryDrawer 
        isOpen={isRunHistoryOpen} 
        onClose={() => setIsRunHistoryOpen(false)} 
      />
    </div>
  )
}

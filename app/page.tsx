"use client"

import nextDynamic from 'next/dynamic';
import { useState, useEffect, useRef, Suspense } from "react"
import { HexMap } from "@/components/citylord/hex-map"
import { AdaptiveHexGrid } from "@/components/citylord/map/adaptive-hex-grid"

import { Leaderboard } from "@/components/citylord/leaderboard"
import { Profile } from "@/components/citylord/profile"
import { BottomNav, TabType } from "@/components/citylord/bottom-nav"
import MissionCenter from "@/components/citylord/MissionCenter"
import { LeaderboardFilter } from "@/components/citylord/leaderboard-filter"
import { RunningStatusBar } from "@/components/citylord/running-status-bar"
import { HexGridOverlay } from "@/components/citylord/hex-grid-overlay"
import { OnboardingGuide } from "@/components/citylord/onboarding-guide"
import { DailyGoalCard } from "@/components/citylord/daily-goal-card"
import { QuickEntry } from "@/components/citylord/quick-entry"
import { Sparkles, Settings, Palette, Plus as PlusIcon, Minus as MinusIcon, Eye, EyeOff } from "lucide-react";
import { TerritoryAlert } from "@/components/citylord/territory-alert"
import { ChallengeInvite } from "@/components/citylord/challenge-invite"
import { AchievementPopup } from "@/components/citylord/achievement-popup"
import { SocialPage } from "@/components/citylord/social/social-page"
import { InviteFriends } from "@/components/citylord/social/invite-friends"
import { AchievementWall } from "@/components/citylord/achievements/achievement-wall"
import { CounterAttackPage, CounterAttackProgressView } from "@/components/citylord/battle/counter-attack-page"
import { NotificationProvider, NotificationPanel, sampleNotifications } from "@/components/citylord/notifications/notification-center"
import { WelcomeScreen, InteractiveTutorial, QuickNavPopup, MapInteractionGuide } from "@/components/citylord/onboarding/complete-onboarding"
import { HexCaptureEffect, AnimatedButton, GpsIndicator, PaceIndicator } from "@/components/citylord/animations"
import { MapHeader } from "@/components/map/MapHeader"
import { CityActivityBanner } from "@/components/map/CityActivityBanner"
import { LoadingScreen } from "@/components/citylord/loading-screen"
import { useRunningTracker } from "@/hooks/useRunningTracker"

const ImmersiveRunningMode = nextDynamic(() => import("@/components/citylord/running/immersive-mode").then(mod => mod.ImmersiveRunningMode), { ssr: false });
const RunningFAB = nextDynamic(() => import("@/components/citylord/running/immersive-mode").then(mod => mod.RunningFAB), { ssr: false });

import { useCity } from "@/contexts/CityContext"
import {
  GpsWeakPopup,
  NetworkBanner,
  LocationPermissionPrompt,
  DataLoadFailedCard,
  StatefulButton
} from "@/components/citylord/feedback/error-feedback"
import { useGameStore, useGameActions, useGameUser } from "@/store/useGameStore";
import { useHydration } from "@/hooks/useHydration";
import { ThemeSwitcher } from "@/components/citylord/theme/theme-provider";
import { ModeSwitcher } from '@/components/mode/ModeSwitcher';
import { SinglePlayer } from '@/components/mode/SinglePlayer';
import { PrivateLobby } from '@/components/mode/PrivateLobby';
import { MyClub } from '@/components/mode/MyClub';
import ClubDetails from '@/components/mode/ClubDetails';

import { AMapViewHandle } from "@/components/map/AMapView";

const AMapView = nextDynamic(() => import("@/components/map/AMapViewWithProvider").then(mod => mod.AMapViewWithProvider), { ssr: false });

import { FactionSelector } from "@/components/social/FactionSelector"
import { ReferralWelcome } from "@/components/social/ReferralWelcome"
import { useSearchParams } from 'next/navigation'
import { processReferral } from "@/app/actions/referral"

export const dynamic = 'force-dynamic';

function CityLordContent() {
  const searchParams = useSearchParams()
  const { isLoading: isCityLoading, currentCity } = useCity()
  const { checkStaminaRecovery, dismissGeolocationPrompt, claimAchievement } = useGameActions()
  const { achievements } = useGameUser()
  const mapViewRef = useRef<AMapViewHandle>(null);
  const [showTerritory, setShowTerritory] = useState(true);

  // 全屏加载状态 - 必须在所有 hooks 之后 return
  const [activeTab, setActiveTab] = useState<TabType>("play")
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
    togglePause: toggleTrackerPause, 
    stop: stopTracker 
  } = useRunningTracker(isRunning)

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

  // New onboarding states
  const [showWelcome, setShowWelcome] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [showQuickNav, setShowQuickNav] = useState(false)
  const [showMapGuide, setShowMapGuide] = useState(false)
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false)
  const [isCityDrawerOpen, setIsCityDrawerOpen] = useState(false);
  const [shouldHideButtons, setShouldHideButtons] = useState(false);

  // Animation demo states
  const [showCaptureEffect, setShowCaptureEffect] = useState(false)
  const [capturePosition, setCapturePosition] = useState({ x: 200, y: 300 })

  // Error/feedback states
  const [showGpsWeakPopup, setShowGpsWeakPopup] = useState(false)
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [gpsStrength, setGpsStrength] = useState(5)

  // Map zoom state for adaptive hex grid
  const [mapZoom, setMapZoom] = useState(17)
  const [useAdaptiveGrid, setUseAdaptiveGrid] = useState(false)
  const [useH3Grid, setUseH3Grid] = useState(true)

  // Get user location from store - use stable selectors to avoid unnecessary re-renders
  const userLat = useGameStore((state) => state.latitude)
  const userLng = useGameStore((state) => state.longitude)
  const gameMode = useGameStore((state) => state.gameMode);
  const gpsError = useGameStore((state) => state.gpsError);
  const hasDismissedGeolocationPrompt = useGameStore((state) => state.hasDismissedGeolocationPrompt);
  const hydrated = useHydration();

  // Check if first visit - 只在首次挂载时执行
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisited')
    if (!hasVisited) {
      const timer = setTimeout(() => {
        setShowWelcome(true)
        localStorage.setItem('hasVisited', 'true')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // Check for referral code in URL
    const refId = searchParams.get('ref')
    if (refId) {
      // Store in cookie for registration flow (if user is new)
      document.cookie = `referral_id=${refId}; path=/; max-age=86400` // 1 day
      
      // If user is already logged in, we could try to process it immediately, 
      // but usually we wait for explicit "Accept" or just handle it during signup/first login.
      // For this MVP, let's assume we handle it if they are logged in now.
      // Note: We need the current user ID, which we get from Supabase auth state or store.
      // Since this is a client component, we might need to trigger a server action if we have the user.
    }
  }, [searchParams])

  // Stamina Recovery Timer
  useEffect(() => {
    // Check immediately on mount/focus
    checkStaminaRecovery()

    // Check every minute
    const interval = setInterval(() => {
      checkStaminaRecovery()
    }, 60000)

    return () => clearInterval(interval)
  }, [checkStaminaRecovery])

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    setShowOnboarding(true)
  }

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  const handleQuickNavigate = (tab: "missions" | "social" | "running") => {
    if (tab === "running") {
      setIsRunning(true)
      setShowImmersiveMode(true)
      triggerCaptureEffect()
    } else {
      setActiveTab(tab)
    }
  }

  const handleShowDemo = (type: "territory" | "challenge" | "achievement") => {
    if (type === "territory") setShowTerritoryAlert(true)
    if (type === "challenge") setShowChallengeInvite(true)
    if (type === "achievement") setShowAchievement(true)
  }

  // Demo capture effect
  const triggerCaptureEffect = () => {
    setCapturePosition({ 
      x: 100 + Math.random() * 200, 
      y: 200 + Math.random() * 200 
    })
    setShowCaptureEffect(true)
  }

  return (
    <div className="relative w-full h-[100dvh] max-w-md mx-auto flex flex-col bg-[#0f172a] overflow-hidden">
      {/* 等待 hydration 完成 */}
      {!hydrated && <LoadingScreen message="正在初始化..." />}

      {/* 等待城市数据加载 */}
      {(isCityLoading || !currentCity) && hydrated && <LoadingScreen message="正在加载城市数据..." />}

      {/* Welcome Screen - First Login */}
      <WelcomeScreen
        isOpen={showWelcome}
        onComplete={handleWelcomeComplete}
        userName="跑者"
      />

      {/* Interactive Tutorial */}
      <InteractiveTutorial
        isOpen={showTutorial}
        onComplete={() => setShowTutorial(false)}
        currentStep={tutorialStep}
        onStepChange={setTutorialStep}
      />

      {/* Quick Nav Popup */}
      <QuickNavPopup
        isOpen={showQuickNav}
        onClose={() => setShowQuickNav(false)}
        onNavigate={(tab) => setActiveTab(tab as TabType)}
      />

      {/* Map Interaction Guide */}
      <MapInteractionGuide
        isOpen={showMapGuide}
        onClose={() => setShowMapGuide(false)}
      />

      {/* Theme Switcher */}
      <ThemeSwitcher
        isOpen={showThemeSwitcher}
        onClose={() => setShowThemeSwitcher(false)}
      />

      {/* Legacy Onboarding Guide */}
      <OnboardingGuide
        isVisible={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      <LocationPermissionPrompt
        isOpen={hydrated && !!gpsError && !hasDismissedGeolocationPrompt}
        onClose={dismissGeolocationPrompt}
        onOpenSettings={() => window.location.reload()} // A simple way to ask for permission again
      />

      {/* Main Content */}
      {hydrated && currentCity && (
        <main className="relative flex-1 overflow-hidden">
        {activeTab === "play" && (
          <div className="relative h-dvh w-full overflow-hidden">
            {/* Core Map Layer */}
      <div className="absolute inset-0 z-0">
        <AMapView 
          ref={mapViewRef} 
          showTerritory={showTerritory}
          onMapLoad={() => {
            // Map loaded
          }}
        />
        <FactionSelector />
        <ReferralWelcome />
      </div>

            {/* UI Layer */}
            <div className="relative z-10 h-full w-full pointer-events-none">
              <div className="pointer-events-auto">
                {/* 地图头部状态栏 - 带有城市选择、赛季进度、跑步数据 */}
                <MapHeader isCityDrawerOpen={isCityDrawerOpen} setIsCityDrawerOpen={setIsCityDrawerOpen} setShowThemeSwitcher={setShowThemeSwitcher} />
              </div>

              {/* Mode Switcher - 仅在地图模式显示 */}
              <div className="pointer-events-auto">
                <ModeSwitcher onDrawerOpenChange={(isOpen) => setShouldHideButtons(isOpen)} />
              </div>

              {/* Bottom controls container - 只在 gameMode === 'map' 时显示今日任务、开始跑步、好友，且抽屉关闭时 */}
              {gameMode === 'map' && !shouldHideButtons && (
                <div className="pointer-events-auto absolute bottom-24 left-4 right-4 z-20 flex justify-center">
                  <QuickEntry onNavigate={handleQuickNavigate} />
                </div>
              )}

              {/* PLAY PAGE LOADED indicator */}
              <div className="absolute bottom-4 left-4 z-20 text-xs text-white/40 pointer-events-none">
                PLAY PAGE LOADED
              </div>
            </div>

            {/* Mode Content - 只在非 map 模式时显示半透明功能面板 */}
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
            {/* 高德地图背景 */}
            <AMapView ref={mapViewRef} showTerritory={showTerritory} />

            {/* UI Layer */}
            <div className="relative z-10 h-full w-full pointer-events-none">
              <div className="pointer-events-auto">
                <MapHeader isCityDrawerOpen={isCityDrawerOpen} setIsCityDrawerOpen={setIsCityDrawerOpen} setShowThemeSwitcher={setShowThemeSwitcher} />
              </div>

              {/* Mode Switcher - 在 mode 标签页也显示 */}
              <div className="pointer-events-auto">
                <ModeSwitcher onDrawerOpenChange={(isOpen) => setShouldHideButtons(isOpen)} />
              </div>

              {/* MODE PAGE LOADED indicator */}
              <div className="absolute bottom-4 left-4 z-20 text-xs text-white/40 pointer-events-none">
                MODE PAGE LOADED
              </div>
            </div>
          </div>
        )}

        {activeTab === "missions" && (
          <div className="absolute inset-0 z-40 bg-[#0f172a]">
            <MissionCenter />
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
            <SocialPage onShowDemo={handleShowDemo} />
          </div>
        )}

        {activeTab === "profile" && (
          <div className="absolute inset-0 z-40 h-full bg-[#0f172a]">
            <Profile onOpenSettings={() => setShowThemeSwitcher(true)} />
          </div>
        )}
      </main>
      )}

      {/* Immersive Running Mode - Full screen overlay */}
      <ImmersiveRunningMode
        isActive={showImmersiveMode}
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
          setIsRunning(false)
          setShowImmersiveMode(false)
          if (!localStorage.getItem('achievement_marathon-hero_claimed')) {
            setShowAchievement(true)
          }
        }}
        onExpand={() => {}}
        currentLocation={currentLocation || undefined}
        onHexClaimed={() => setSessionHexes(prev => prev + 1)}
      />

      {/* Bottom Navigation */}
      {hydrated && currentCity && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}

      {/* Interactive Popup Components */}
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
          setIsRunning(true)
          setActiveTab("play")
        }}
      />

      <AchievementPopup
        isOpen={showAchievement}
        onClose={() => setShowAchievement(false)}
        achievement={{
          id: "marathon-hero",
          title: "马拉松英雄",
          description: "累计跑步距离达到42.195公里，你已成为真正的长跑者！",
          icon: "🏅",
          rarity: "epic",
          unlockedAt: "2025年1月25日",
        }}
        rewards={[
          { type: "xp", amount: 500, label: "经验值" },
          { type: "coins", amount: 200, label: "金币" },
          { type: "badge", amount: 1, label: "专属徽章" },
        ]}
        onClaim={() => {
          localStorage.setItem('achievement_marathon-hero_claimed', 'true')
          claimAchievement('marathon-hero')
          setShowAchievement(false)
        }}
        onShare={() => {
          // Handle share
        }}
      />

      {/* Error Feedback Components */}
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
        onOpenSettings={() => {
          setShowPermissionPrompt(false)
        }}
      />
    </div>
  )
}

export default function CityLordApp() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CityLordContent />
    </Suspense>
  )
}

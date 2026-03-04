"use client"

import React from "react"
import { AvatarUploader } from "@/components/ui/AvatarUploader"
import Image from "next/image"

import { MapPin, Swords, Footprints, Eye, Settings, ChevronRight, Hexagon, Zap, Target, LogIn, LogOut, Edit2, Gift, MessageSquareWarning, Sparkles, Shuffle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration";
import { formatAreaFromHexCount, getAreaEquivalentFromHexCount } from "@/lib/citylord/area-utils"
import { useQuery } from '@tanstack/react-query'
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { calculateLevel, getNextLevelProgress, getTitle } from "@/lib/game-logic/level-system"
import { BadgeGrid } from "@/components/citylord/achievements/BadgeGrid"
import { FactionComparison } from "@/components/citylord/FactionComparison"
import { useUserBadges } from "@/hooks/useGameData"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FactionBattleBackground } from "@/components/Faction/FactionBattleBackground"
import { Loader2, TrendingUp } from "lucide-react"
import { ThemeSwitcher } from "@/components/citylord/theme/ThemeSwitcher"

import { ReportButton } from '@/components/report/ReportButton'
import { AccountManager } from '@/components/citylord/profile/AccountManager'

interface ProfileProps {
  onOpenSettings: () => void
  initialFactionStats?: any
  initialBadges?: any[]
}

export function Profile({ onOpenSettings, initialFactionStats, initialBadges }: ProfileProps) {
  const hydrated = useHydration();
  const router = useRouter()
  const {
    nickname,
    userId,
    level,
    currentExp,
    maxExp,
    stamina,
    maxStamina,
    totalArea,
    avatar,
    backgroundUrl,
    setNickname,
    setAvatar,
    resetUser,
    syncUserProfile
  } = useGameStore()

  const [isEditing, setIsEditing] = React.useState(false)
  const [editName, setEditName] = React.useState("")
  const [editAvatar, setEditAvatar] = React.useState("")
  const [pathColor, setPathColor] = React.useState("#3B82F6")
  const [fillColor, setFillColor] = React.useState("#3B82F6")
  const [userEmail, setUserEmail] = React.useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)
  const [loading, setLoading] = React.useState(true)

  // Use React Query for stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['userProfileStats', userId],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/user/stats`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: userBadgesData, isLoading: badgesLoading } = useUserBadges()

  const [recentRuns, setRecentRuns] = React.useState<any[]>([]);
  const [loadingRuns, setLoadingRuns] = React.useState(true);

  React.useEffect(() => {
    const fetchRuns = async () => {
      try {
        const res = await fetch(`/api/user/activities?limit=3`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch activities');
        const runs = await res.json();
        setRecentRuns(runs);
      } catch (e) {
        console.error("Failed to fetch recent runs", e);
      } finally {
        setLoadingRuns(false);
      }
    };
    if (userId) fetchRuns();
  }, [userId]);

  // Use a derived isLoading that combines profile and badges loading
  const isLoading = loading || badgesLoading

  // Derive stats from query data or fallback
  const userStats = stats || {
    totalTiles: 0,
    totalArea: 0,
    totalDistance: 0,
    battlesWon: 0,
    faction: null as 'RED' | 'BLUE' | null
  }

  // Faction Stats State
  const [factionStats, setFactionStats] = React.useState<any>(initialFactionStats ?? null);
  const [dailyStat, setDailyStat] = React.useState<any>(null);

  React.useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/faction/daily-stats`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(setDailyStat)
      .catch(err => console.error('Failed to fetch daily stats:', err))
  }, [])

  // Fetch complete stats including member counts
  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/faction/stats`, { credentials: 'include' })
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.status}`)
        }
        const stats = await res.json()
        setFactionStats(stats)
      } catch (err) {
        console.error("Error fetching faction stats:", err);
        setFactionStats({ red_faction: 0, blue_faction: 0, red_area: 0, blue_area: 0 });
      }
    };

    fetchStats();
  }, []);

  React.useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient()
      // Use getSession instead of getUser for faster client-side check
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (user) {
        setIsLoggedIn(true)
        if (user.email) setUserEmail(user.email)

        // Immediate UI render
        setLoading(false)

        // Sync global store in background
        syncUserProfile()
      } else {
        setIsLoggedIn(false)
        setLoading(false)
      }
    }
    checkUser()
  }, [])

  // Load colors when editing starts
  React.useEffect(() => {
    if (isEditing && userId) {
      const loadColors = async () => {
        const supabase = createClient()
        const { data } = await (supabase
          .from('profiles' as any) as any)
          .select('path_color, fill_color')
          .eq('id', userId)
          .single()

        if (data) {
          if (data.path_color) setPathColor(data.path_color)
          if (data.fill_color) setFillColor(data.fill_color)
        }
      }
      loadColors()
    }
  }, [isEditing, userId])

  React.useEffect(() => {
    return () => {
      // Cleanup logic if needed
      // Ensure we don't crash on unmount
      // If there are map instances or fog layers, they should be cleaned up here
      // Example: if (fogPolygon) { fogPolygon.remove(); }
      // Since fogPolygon is likely inside FactionBattleBackground or similar, 
      // we just ensure no dangling async calls or listeners here.
    }
  }, [])

  // If we have store data (nickname/level), we can show the UI immediately
  // while "loading" might still be true for the session check.
  // But to be safe, we use the local loading state for the auth check.
  if (loading) {
    // Show skeleton or simple loading
    return (
      <div className="flex h-full flex-col bg-background animate-pulse">
        <div className="border-b border-border bg-card/40 px-4 pb-4 pt-4 shrink-0 h-[220px]">
          <div className="w-24 h-24 rounded-full bg-muted mx-auto mt-3" />
          <div className="w-28 h-6 rounded bg-muted mx-auto mt-3" />
        </div>
        <div className="p-4 space-y-3">
          <div className="h-16 bg-muted/50 rounded-xl" />
          <div className="h-16 bg-muted/50 rounded-xl" />
          <div className="h-16 bg-muted/50 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 pt-20 space-y-6 bg-background">
        <div className="relative w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center border-2 border-border">
          <LogIn className="w-10 h-10 text-muted-foreground/50" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">未登录</h2>
          <p className="text-sm text-muted-foreground">登录后查看您的个人档案、成就和领地数据</p>
        </div>

        <Link href="/login" className="w-full max-w-xs">
          <Button
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-full shadow-sm border border-primary/50"
          >
            立即登录 / 注册
          </Button>
        </Link>
      </div>
    )
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error("昵称不能为空")
      return
    }

    // 更新本地状态
    setNickname(editName)
    if (editAvatar) {
      setAvatar(editAvatar)
    }

    // 如果已登录，同步到 Supabase
    if (userEmail) {
      const supabase = createClient()
      const updates: any = {
        nickname: editName,
        path_color: pathColor,
        fill_color: fillColor
      }
      if (editAvatar) {
        updates.avatar_url = editAvatar
      }

      const { error } = await (supabase
        .from('profiles' as any) as any)
        .update(updates)
        .eq('id', userId)

      if (error) {
        toast.error("同步失败")
        console.error(error)
      } else {
        toast.success("保存成功")
      }
    } else {
      toast.success("保存成功 (本地)")
    }
    setIsEditing(false)
  }

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      resetUser()
      setUserEmail(null)
      toast.success("已退出登录")

      // Force refresh to update server components (like avatar in header)
      router.refresh()
      // Replace to prevent back navigation
      router.replace('/')
    } catch (error) {
      console.error('Logout failed:', error)
      toast.error('退出登录失败，请重试')
    }
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center bg-background text-muted-foreground">加载中...</div>;
  }

  // 计算经验进度百分比
  const xpProgress = Math.floor((currentExp / maxExp) * 100)

  // Real stats from DB
  const territoryHexCount = userStats.totalTiles
  const territoryArea = formatAreaFromHexCount(territoryHexCount)
  const areaEquivalent = getAreaEquivalentFromHexCount(territoryHexCount)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header with Avatar */}
      <div className="relative border-b border-border bg-card/40 px-4 pb-4 pt-4 backdrop-blur-xl shrink-0">
        {/* Dynamic Faction Background or Custom Profile Background */}
        <div className="absolute inset-0 overflow-hidden rounded-b-3xl z-0">
          {backgroundUrl ? (
            <>
              <Image
                src={backgroundUrl}
                alt="Profile Background"
                fill
                className="object-cover opacity-80"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
            </>
          ) : (
            <FactionBattleBackground
              userFaction={userStats.faction?.toLowerCase() === 'red' ? 'red' : 'blue'}
              red_area={factionStats?.red_area ?? factionStats?.redArea ?? 0}
              blue_area={factionStats?.blue_area ?? factionStats?.blueArea ?? 0}
              isLoading={!factionStats}
              className="opacity-50 pointer-events-none"
            />
          )}
        </div>

        {/* Settings Button - Moved to bottom right to avoid conflict with top faction labels */}
        <button onClick={onOpenSettings} className="absolute right-4 bottom-6 rounded-full border border-border bg-card/50 p-2 z-20 hover:bg-card/80 transition-colors">
          <Settings className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Avatar with XP Ring */}
        <div className="flex flex-col items-center relative z-10 pt-4">
          <div className="relative">
            {/* XP Progress Ring */}
            <svg className="h-24 w-24 -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="42"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                stroke="url(#gradient)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - xpProgress / 100)}`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#39ff14" />
                  <stop offset="100%" stopColor="#00ff88" />
                </linearGradient>
              </defs>
            </svg>
            {/* Avatar */}
            <button
              className="absolute inset-3 flex items-center justify-center rounded-full bg-gradient-to-br from-[#39ff14] to-[#39ff14]/50 overflow-hidden group cursor-pointer transition-transform active:scale-95 z-10"
              onClick={() => {
                setEditName(nickname)
                setEditAvatar(avatar)
                setIsEditing(true)
              }}
            >
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">🎯</span>
              )}
              {/* Edit Overlay */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Edit2 className="w-6 h-6 text-white drop-shadow-md" />
              </div>
            </button>
            {/* Level Badge */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full border border-[#39ff14]/50 bg-background px-2 py-0.5 z-20">
              <span className="text-xs font-bold text-[#39ff14]">LVL {level}</span>
            </div>
          </div>

          <h1 className="mt-3 text-xl font-bold text-foreground flex items-center gap-2">
            {nickname}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
              <DialogTrigger asChild>
                <button
                  onClick={() => {
                    setEditName(nickname)
                    setEditAvatar(avatar)
                  }}
                  className="p-1.5 rounded-full bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>修改资料</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    更新您的个人信息，包括头像、昵称和个性化颜色。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/70">头像</label>
                    <div className="flex items-center gap-4">
                      <AvatarUploader
                        currentAvatarUrl={editAvatar}
                        onUploadComplete={(url) => setEditAvatar(url)}
                        size={80}
                      />
                      <div className="text-xs text-muted-foreground flex-1">
                        点击头像上传新图片。<br />
                        支持 JPG, PNG 格式，最大 2MB。
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/70">昵称</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-muted/20 border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground/70">主题风格</label>
                    <ThemeSwitcher />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/70">路径颜色</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={pathColor}
                          onChange={(e) => setPathColor(e.target.value)}
                          className="h-10 w-full p-1 bg-muted/20 border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{pathColor}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground/70">领地填充</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={fillColor}
                          onChange={(e) => setFillColor(e.target.value)}
                          className="h-10 w-full p-1 bg-muted/20 border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono">{fillColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-muted-foreground hover:text-foreground hover:bg-muted/10">取消</Button>
                  <Button onClick={handleSaveProfile} className="bg-primary text-primary-foreground hover:bg-primary/90">保存</Button>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">ID: {userId.slice(-8)}</p>

          {/* XP Bar */}
          <div className="mt-2.5 w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">经验进度</span>
              <span className="text-[#39ff14]">{currentExp.toLocaleString()} / {maxExp.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#39ff14] to-[#00ff88]"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="mt-2 w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-muted-foreground">体力值</span>
              <span className="text-cyan-400">{stamina} / {maxStamina}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                style={{ width: `${(stamina / maxStamina) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 themed-scrollbar">

        {/* Task 3: My Run Records */}
        <div className="p-4 pb-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">我的跑步记录</h2>
            <div className="flex items-center gap-2">
              <ReportButton userId={userId} period="daily" variant="ghost" className="h-6 px-2 text-xs" />
              <Link href="/profile/me" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                查看全部 <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          <div className="space-y-2">
            {loadingRuns ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : recentRuns.length > 0 ? (
              recentRuns.map((run) => (
                <Link href={`/run/detail?id=${run.id}`} key={run.id} className="block rounded-xl border border-border bg-card/50 p-2.5 transition-all hover:bg-card/80 active:scale-[0.99]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {/* Map Thumbnail Placeholder or Icon */}
                      <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center border border-white/5">
                        <Footprints className="w-5 h-5 text-muted-foreground/50" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-foreground">{run.distance_km?.toFixed(2) || '0.00'} km</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            {run.pace_min_per_km || '--'}/km
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(run.created_at).toLocaleDateString()} · {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-mono font-medium text-foreground">{run.duration_str || '--:--'}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1 mt-1">
                        <TrendingUp className="w-3 h-3" />
                        <span>{run.calories || 0} kcal</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm bg-card/30 rounded-xl border border-border/50 border-dashed">
                暂无跑步记录，快去跑一场吧！
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">你的数据</h2>
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              icon={<Footprints className="h-4 w-4" />}
              label="总里程"
              value={Number(userStats.totalDistance || 0).toFixed(2)}
              unit="公里"
              color="text-[#39ff14]"
            />
            <StatCard
              icon={<Hexagon className="h-4 w-4" />}
              label="占领面积"
              value={territoryArea.value}
              unit={territoryArea.unit}
              color="text-cyan-400"
              subtitle={areaEquivalent || undefined}
            />
            <StatCard
              icon={<Swords className="h-4 w-4" />}
              label="战斗胜利"
              value={Number(userStats.battlesWon || 0).toString()}
              unit="胜"
              color="text-purple-400"
            />
            <StatCard
              icon={<Eye className="h-4 w-4" />}
              label="迷雾探索"
              value="0"
              unit="%"
              color="text-yellow-400"
            />
            <StatCard
              icon={<Zap className="h-4 w-4" />}
              label="当前等级"
              value={level.toString()}
              unit="级"
              color="text-orange-400"
            />
            <StatCard
              icon={<Target className="h-4 w-4" />}
              label="总占领地块"
              value={Number(userStats.totalTiles || 0).toLocaleString()}
              unit="块"
              color="text-pink-400"
            />
          </div>
        </div>

        {/* Badges Grid */}
        <div className="px-4 pb-4">
          <FactionComparison
            userFaction={userStats.faction?.toLowerCase() === 'red' ? 'RED' : userStats.faction?.toLowerCase() === 'blue' ? 'BLUE' : null}
            initialData={factionStats}
            dailyStat={dailyStat}
          />

          {/* Faction Change Button */}
          {userStats.faction && (
            <FactionChangeButton
              currentFaction={userStats.faction.toLowerCase() === 'red' ? 'RED' : 'BLUE'}
              onChanged={() => {
                syncUserProfile();
                // Refetch faction stats
                fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/faction/stats`, { credentials: 'include' })
                  .then(res => res.ok ? res.json() : null)
                  .then(data => { if (data) setFactionStats(data); })
                  .catch(() => { });
              }}
            />
          )}

          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">勋章墙</h2>
          <div className="rounded-xl border border-border bg-card/50 p-3">
            <BadgeGrid />
          </div>
        </div>

        {/* Account Management */}
        <div className="px-4 pb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">账号管理</h2>
          <AccountManager userId={userId} />
        </div>

        {/* Quick Actions */}
        <div className="mt-auto border-t border-border p-4">
          {/* Background Settings */}
          <Link href="/profile/backgrounds" className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-gradient-to-r from-purple-500/10 to-indigo-500/10 p-3 transition-all active:bg-muted/10 hover:bg-card/80">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 shadow-lg shadow-purple-500/20">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">个性化主页</p>
                <p className="text-xs text-muted-foreground">挑选动态封面，装扮个人资料</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>

          {/* Invite Friends Entry */}
          <Link href="/referral" className="mb-2 flex w-full items-center justify-between rounded-xl border border-border bg-gradient-to-r from-orange-500/10 to-rose-500/10 p-3 transition-all active:bg-muted/10 hover:bg-card/80">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 shadow-lg shadow-orange-500/20">
                <Gift className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">邀请好友</p>
                <p className="text-xs text-muted-foreground">邀请好友加入，解锁专属奖励</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>

          <Link href="/feedback" className="flex w-full items-center justify-between rounded-xl border border-border bg-card/50 p-3 transition-all active:bg-muted/10 hover:bg-card/80">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
                <MessageSquareWarning className="h-4 w-4 text-yellow-500" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">问题反馈</p>
                <p className="text-xs text-muted-foreground">提交Bug或改进建议</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </Link>

          {userEmail ? (
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-card/50 p-3 transition-all active:bg-muted/10 hover:bg-card/80"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20">
                  <LogOut className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">退出登录</p>
                  <p className="text-xs text-muted-foreground">当前账号: {userEmail}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </button>
          ) : (
            <Link href="/login" className="mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-card/50 p-3 transition-all active:bg-muted/10 hover:bg-card/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/20">
                  <LogIn className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">登录账号</p>
                  <p className="text-xs text-muted-foreground">同步数据并保护进度</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  unit,
  color,
  subtitle,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  color: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-2">
      <div className={`mb-0.5 ${color}`}>{icon}</div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-base font-bold text-foreground leading-tight">
        {value}
        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground/60">{unit}</span>
      </p>
      {subtitle && (
        <p className="mt-0.5 text-[9px] text-muted-foreground/50">{subtitle}</p>
      )}
    </div>
  )
}

function AchievementRow({
  icon,
  title,
  description,
  progress,
}: {
  icon: string
  title: string
  description: string
  progress: number
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/50 p-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/20 text-base">
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted/20">
          <div
            className={`h-full rounded-full ${progress === 100 ? "bg-[#39ff14]" : "bg-muted/60"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {progress === 100 && <span className="text-lg">✅</span>}
    </div>
  )
}

// ==================== Faction Change Button ====================

function FactionChangeButton({ currentFaction, onChanged }: { currentFaction: 'RED' | 'BLUE'; onChanged: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [cooldownMsg, setCooldownMsg] = React.useState<string | null>(null);

  const targetFaction = currentFaction === 'RED' ? 'BLUE' : 'RED';
  const targetName = targetFaction === 'RED' ? '赤红先锋' : '蔚蓝联盟';
  const currentName = currentFaction === 'RED' ? '赤红先锋' : '蔚蓝联盟';
  const targetColor = targetFaction === 'RED' ? 'from-red-500 to-orange-500' : 'from-blue-500 to-cyan-500';
  const targetTextColor = targetFaction === 'RED' ? 'text-red-400' : 'text-blue-400';

  const handleChangeFaction = async () => {
    setLoading(true);
    setCooldownMsg(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/faction/change-faction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ faction: targetFaction })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `已加入${targetName}`);
        setOpen(false);
        onChanged();
      } else if (res.status === 429) {
        setCooldownMsg(`冷却中：还需 ${data.remainingHours || '?'} 小时`);
      } else {
        toast.error(data.error || '变更失败');
      }
    } catch (e) {
      console.error('Faction change error:', e);
      toast.error('网络错误，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <Dialog open={open} onOpenChange={(val) => { setOpen(val); setCooldownMsg(null); }}>
        <DialogTrigger asChild>
          <button className="w-full flex items-center justify-between rounded-xl border border-border bg-card/50 p-3 transition-all active:bg-muted/10 hover:bg-card/80">
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${targetColor} shadow-lg`}>
                <Shuffle className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">变更阵营</p>
                <p className="text-xs text-muted-foreground">当前：{currentName}（每周限1次）</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </button>
        </DialogTrigger>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认变更阵营</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              您即将从 <span className={currentFaction === 'RED' ? 'text-red-400 font-bold' : 'text-blue-400 font-bold'}>{currentName}</span> 转入{' '}
              <span className={`${targetTextColor} font-bold`}>{targetName}</span>。
              每周仅可变更一次。
            </DialogDescription>
          </DialogHeader>
          {cooldownMsg && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-400 text-center">
              ⏳ {cooldownMsg}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">取消</Button>
            <Button
              onClick={handleChangeFaction}
              disabled={loading}
              className={`bg-gradient-to-r ${targetColor} text-white hover:opacity-90`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              确认加入{targetName}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

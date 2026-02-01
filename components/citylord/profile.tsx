"use client"

import React from "react"
import { AvatarUploader } from "@/components/ui/AvatarUploader"

import { MapPin, Swords, Footprints, Eye, Settings, ChevronRight, Hexagon, Zap, Target, LogIn, LogOut, Edit2 } from "lucide-react"
import Link from "next/link"
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration";
import { formatAreaFromHexCount, getAreaEquivalentFromHexCount } from "@/lib/citylord/area-utils"
import { createClient } from "@/lib/supabase/client"
import { getUserProfileStats } from "@/app/actions/user"
import { fetchUserAchievements } from "@/app/actions/achievement"
import { toast } from "sonner"
import { calculateLevel, getNextLevelProgress, getTitle } from "@/lib/game-logic/level-system"
import { BadgeGrid } from "@/components/citylord/achievements/BadgeGrid"
import { Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
export function Profile({ onOpenSettings }: { onOpenSettings: () => void }) {
  const hydrated = useHydration();
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
    setNickname,
    setAvatar,
    resetUser,
    syncUserProfile
  } = useGameStore()

  const [isEditing, setIsEditing] = React.useState(false)
  const [editName, setEditName] = React.useState("")
  const [editAvatar, setEditAvatar] = React.useState("")
  const [userEmail, setUserEmail] = React.useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [statsLoading, setStatsLoading] = React.useState(true)
  const [userStats, setUserStats] = React.useState({
    totalTiles: 0,
    totalArea: 0,
    totalDistance: 0,
    battlesWon: 0
  })
  const [userAchievements, setUserAchievements] = React.useState<any[]>([])

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
            
            // Fetch stats and achievements in parallel
            try {
                const [stats, ach] = await Promise.all([
                    getUserProfileStats(),
                    fetchUserAchievements()
                ])
                
                if (stats) setUserStats(stats)
                if (ach) setUserAchievements(ach)
            } catch (e: any) {
                if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
                    console.error("Failed to load profile stats", e)
                }
            } finally {
                setStatsLoading(false)
            }
        } else {
            setIsLoggedIn(false)
            setLoading(false)
            setStatsLoading(false)
        }
    }
    checkUser()
  }, [])

  // If we have store data (nickname/level), we can show the UI immediately
  // while "loading" might still be true for the session check.
  // But to be safe, we use the local loading state for the auth check.
  if (loading) {
     // Show skeleton or simple loading
     return (
        <div className="flex h-full flex-col bg-[#1a1a1a] animate-pulse">
            <div className="border-b border-white/10 bg-black/40 px-4 pb-6 pt-6 shrink-0 h-[280px]">
               <div className="w-32 h-32 rounded-full bg-white/10 mx-auto mt-4"/>
               <div className="w-32 h-8 rounded bg-white/10 mx-auto mt-4"/>
            </div>
            <div className="p-4 space-y-4">
                <div className="h-20 bg-white/5 rounded-xl"/>
                <div className="h-20 bg-white/5 rounded-xl"/>
                <div className="h-20 bg-white/5 rounded-xl"/>
            </div>
        </div>
     )
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 pt-20 space-y-6">
        <div className="relative w-24 h-24 rounded-full bg-white/5 flex items-center justify-center border-2 border-white/10">
          <LogIn className="w-10 h-10 text-white/30" />
        </div>
        
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-white">未登录</h2>
          <p className="text-sm text-white/50">登录后查看您的个人档案、成就和领地数据</p>
        </div>

        <Link href="/login" className="w-full max-w-xs">
          <Button 
            className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold h-12 rounded-full"
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
        const updates: any = { nickname: editName }
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
    const supabase = createClient()
    await supabase.auth.signOut()
    resetUser()
    setUserEmail(null)
    toast.success("已退出登录")
  }

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-white/60">加载中...</div>;
  }

  // 计算经验进度百分比
  const xpProgress = Math.floor((currentExp / maxExp) * 100)

  // Real stats from DB
  const territoryHexCount = userStats.totalTiles
  const territoryArea = formatAreaFromHexCount(territoryHexCount)
  const areaEquivalent = getAreaEquivalentFromHexCount(territoryHexCount)

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a]">
      {/* Header with Avatar */}
      <div className="relative border-b border-white/10 bg-black/40 px-4 pb-6 pt-6 backdrop-blur-xl shrink-0">
        {/* Settings Button */}
        <button onClick={onOpenSettings} className="absolute right-4 top-6 rounded-full border border-white/10 bg-white/5 p-2">
          <Settings className="h-5 w-5 text-white/60" />
        </button>

        {/* Avatar with XP Ring */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {/* XP Progress Ring */}
            <svg className="h-32 w-32 -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="url(#gradient)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 58}`}
                strokeDashoffset={`${2 * Math.PI * 58 * (1 - xpProgress / 100)}`}
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
            <div className="absolute inset-4 flex items-center justify-center rounded-full bg-gradient-to-br from-[#39ff14] to-[#39ff14]/50 overflow-hidden">
               {avatar ? (
                 <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-5xl">🎯</span>
               )}
            </div>
            {/* Level Badge */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-[#39ff14]/50 bg-[#1a1a1a] px-3 py-1">
              <span className="text-sm font-bold text-[#39ff14]">LVL {level}</span>
            </div>
          </div>

          <h1 className="mt-4 text-2xl font-bold text-white flex items-center gap-2">
            {nickname}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                    <button 
                        onClick={() => {
                            setEditName(nickname)
                            setEditAvatar(avatar)
                        }}
                        className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5 text-white/60" />
                    </button>
                </DialogTrigger>
                <DialogContent className="bg-zinc-900 border-white/10 text-white sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>修改资料</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70">头像</label>
                            <div className="flex items-center gap-4">
                                <AvatarUploader
                                    currentAvatarUrl={editAvatar}
                                    onUploadComplete={(url) => setEditAvatar(url)}
                                    size={80}
                                />
                                <div className="text-xs text-white/50 flex-1">
                                    点击头像上传新图片。<br/>
                                    支持 JPG, PNG 格式，最大 2MB。
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/70">昵称</label>
                            <Input 
                                value={editName} 
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-black/40 border-white/10 text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-white/60 hover:text-white hover:bg-white/10">取消</Button>
                        <Button onClick={handleSaveProfile} className="bg-[#39ff14] text-black hover:bg-[#32e010]">保存</Button>
                    </div>
                </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-white/60">ID: {userId.slice(-8)}</p>

          {/* XP Bar */}
          <div className="mt-4 w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-white/60">经验进度</span>
              <span className="text-[#39ff14]">{currentExp.toLocaleString()} / {maxExp.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#39ff14] to-[#00ff88]"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>

          {/* Stamina Bar */}
          <div className="mt-3 w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-white/60">体力值</span>
              <span className="text-cyan-400">{stamina} / {maxStamina}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                style={{ width: `${(stamina / maxStamina) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Stats Grid */}
        <div className="p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">你的数据</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Footprints className="h-6 w-6" />}
              label="总里程"
              value={userStats.totalDistance.toString()}
              unit="公里"
              color="text-[#39ff14]"
            />
            <StatCard
              icon={<Hexagon className="h-6 w-6" />}
              label="占领面积"
              value={territoryArea.value}
              unit={territoryArea.unit}
              color="text-cyan-400"
              subtitle={areaEquivalent || undefined}
            />
            <StatCard
              icon={<Swords className="h-6 w-6" />}
              label="战斗胜利"
              value={userStats.battlesWon.toString()}
              unit="胜"
              color="text-purple-400"
            />
            <StatCard
              icon={<Eye className="h-6 w-6" />}
              label="迷雾探索"
              value="0" 
              unit="%"
              color="text-yellow-400"
            />
            <StatCard
              icon={<Zap className="h-6 w-6" />}
              label="当前等级"
              value={level.toString()}
              unit="级"
              color="text-orange-400"
            />
            <StatCard
              icon={<Target className="h-6 w-6" />}
              label="总占领地块"
              value={userStats.totalTiles.toLocaleString()}
              unit="块"
              color="text-pink-400"
            />
          </div>
        </div>

        {/* Badges Grid */}
        <div className="px-4 pb-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">勋章墙</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <BadgeGrid />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-auto border-t border-white/10 p-4">
          <button className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-all active:bg-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#39ff14]/20">
                <Target className="h-5 w-5 text-[#39ff14]" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-white">每日挑战</p>
                <p className="text-sm text-white/60">跑步5公里获取额外经验</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-white/40" />
          </button>

          {userEmail ? (
            <button 
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-all active:bg-white/10"
            >
                <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20">
                    <LogOut className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-left">
                    <p className="font-semibold text-white">退出登录</p>
                    <p className="text-sm text-white/60">当前账号: {userEmail}</p>
                </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
          ) : (
            <Link href="/login" className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 transition-all active:bg-white/10">
                <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/20">
                    <LogIn className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="text-left">
                    <p className="font-semibold text-white">登录账号</p>
                    <p className="text-sm text-white/60">同步数据并保护进度</p>
                </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40" />
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className={`mb-2 ${color}`}>{icon}</div>
      <p className="text-xs text-white/60">{label}</p>
      <p className="text-2xl font-bold text-white">
        {value}
        <span className="ml-1 text-sm font-normal text-white/40">{unit}</span>
      </p>
      {subtitle && (
        <p className="mt-1 text-[10px] text-white/40">{subtitle}</p>
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
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white">{title}</p>
        <p className="text-xs text-white/60">{description}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${progress === 100 ? "bg-[#39ff14]" : "bg-white/40"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {progress === 100 && <span className="text-lg">✅</span>}
    </div>
  )
}

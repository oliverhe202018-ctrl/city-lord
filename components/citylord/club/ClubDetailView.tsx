'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchClubDetailsCached = async (clubId: string) => {
  const res = await fetchWithTimeout(`/api/club/get-club-details-cached?clubId=${clubId}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch club details')
  return await res.json()
}

const joinClub = async (clubId: string) => {
  const res = await fetchWithTimeout('/api/club/join-club', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clubId }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to join club')
  return await res.json()
}

const fetchClubRankStats = async (clubId: string) => {
  const res = await fetchWithTimeout(`/api/club/get-club-rank-stats?clubId=${clubId}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch rank stats')
  return await res.json()
}

const fetchTopClubsByArea = async (limit?: number, province?: string) => {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (province) params.set('province', province)
  const qs = params.toString()
  const res = await fetchWithTimeout(`/api/club/get-top-clubs-by-area${qs ? `?${qs}` : ''}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch top clubs')
  return await res.json()
}

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Map, Users, Footprints, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/useGameStore'
import { toast } from 'sonner'
import { isNativePlatform, safeKeyboardAddListener } from "@/lib/capacitor/safe-plugins"


type ClubDetailInfo = {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  memberCount: number
  province?: string
  totalArea?: number
}

type ClubDetailMember = {
  id: string
  name: string
  avatarUrl?: string | null
  role: 'owner' | 'admin' | 'member'
  level: number
}

type ClubDetailStats = {
  totalDistanceKm: number
  totalCalories: number
  memberCount: number
}

function formatDistance(value: number) {
  return `${value.toFixed(1)} km`
}

function formatCalories(value: number) {
  return `${value.toLocaleString()} kcal`
}

function roleLabel(role: ClubDetailMember['role']) {
  if (role === 'owner') return '会长'
  if (role === 'admin') return '管理员'
  return '成员'
}

function isPublicUrl(value?: string | null) {
  return !!value && (/^https?:\/\//i.test(value) || value.startsWith('data:'))
}

type TopClub = {
  id: string
  name: string
  avatar: string
  displayArea: string
  totalArea: number
}

export function ClubDetailView({
  clubId,
  onChange,
  isJoined = false,
  onJoin,
  isJoining = false,
  onBack,
  topClubs = []
}: {
  clubId: string;
  onChange?: () => void;
  isJoined?: boolean;
  onJoin?: () => Promise<boolean> | void;
  isJoining?: boolean;
  onBack?: () => void;
  topClubs?: TopClub[];
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Local state to override Props for immediate UI transition
  const [hasJoined, setHasJoined] = useState(false);
  const effectiveIsMember = isJoined || hasJoined;

  // ✅ 新增：键盘高度管理
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const joinButtonContainerRef = useRef<HTMLDivElement>(null);
  const [joinButtonHeight, setJoinButtonHeight] = useState(0);

  // ✅ 新增：监听键盘事件
  useEffect(() => {
    let showListenerHandle: any;
    let hideListenerHandle: any;

    const setupListeners = async () => {
      if (!(await isNativePlatform())) return
      showListenerHandle = await safeKeyboardAddListener('keyboardWillShow', (info) => {
        setKeyboardHeight(info.keyboardHeight)
      })
      hideListenerHandle = await safeKeyboardAddListener('keyboardWillHide', () => {
        setKeyboardHeight(0)
      })
    }

    setupListeners();

    return () => {
      if (showListenerHandle) showListenerHandle.remove();
      if (hideListenerHandle) hideListenerHandle.remove();
    }
  }, [])

  useEffect(() => {
    if (joinButtonContainerRef.current) {
      setJoinButtonHeight(joinButtonContainerRef.current.offsetHeight);
    }
  }, [effectiveIsMember]);


  // Optimized Data Fetching with SWR & Server Action Cache
  const { data: cachedClub, isLoading: isClubLoading, error: clubError } = useSWR(
    clubId ? ['club-details', clubId] : null,
    ([_, id]) => fetchClubDetailsCached(id),

    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  const [club, setClub] = useState<ClubDetailInfo | null>(null)
  const [members, setMembers] = useState<ClubDetailMember[]>([])
  const [stats, setStats] = useState<ClubDetailStats>({
    totalDistanceKm: 0,
    totalCalories: 0,
    memberCount: 0
  })
  const [rankings, setRankings] = useState<{ global: number; provincial: number }>({ global: 0, provincial: 0 })

  const [rankType, setRankType] = useState<'global' | 'local'>('global');
  const [topClubsLocal, setTopClubsLocal] = useState<TopClub[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(members.length / ITEMS_PER_PAGE);
  const displayMembers = members.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleJoinClick = async () => {
    if (onJoin) {
      // If onJoin prop is provided (legacy or wrapper), use it
      const result = await onJoin();
      if (result === true) {
        setHasJoined(true);
      }
    } else {
      // API route call
      try {
        const result = await joinClub(clubId)

        if (result.success) {
          setHasJoined(true);

          // ✅ 同步更新 Zustand
          if (result.clubId) {
            useGameStore.getState().updateClubId(result.clubId)
          }

          const message = result.status === 'active'
            ? '加入成功！'
            : '申请已提交，等待审核'

          toast.success(message)

          // ✅ 关键：延迟 500ms 后跳转到 /club 页面
          setTimeout(() => {
            router.push('/club')
            router.refresh() // 强制刷新数据
          }, 500)
        } else {
          toast.error(result.error || '加入失败')
        }
      } catch (e) {
        console.error('Join club error:', e)
        toast.error('网络请求失败')
      }
    }
  };


  useEffect(() => {
    if (!clubId) return

    const load = async () => {
      // 1. If we have cached data, sync it to 'club' state first for immediate UI
      if (cachedClub) {
        const toPublicUrl = (path: string | null | undefined, bucket: string) => {
          if (!path) return null
          if (isPublicUrl(path)) return path
          const { data } = supabase.storage.from(bucket).getPublicUrl(path)
          return data.publicUrl || null
        }

        setClub({
          id: cachedClub.id || cachedClub.club_id,
          name: cachedClub.name,
          description: cachedClub.description,
          avatarUrl: toPublicUrl(cachedClub.avatar_url, 'clubs'),
          memberCount: cachedClub.total_member_count || cachedClub.member_count || 0,
          province: cachedClub.province,
          totalArea: Number(cachedClub.total_area) || 0
        })
      }

      // 2. Fetch additional details (rankings, members, stats)
      const rankStatsPromise = fetchClubRankStats(clubId)

      const memberRowsPromise = supabase
        .from('club_members')
        .select(`
          user_id,
          role,
          profiles (
            nickname,
            avatar_url,
            level
          )
        `)
        .eq('club_id', clubId)
        .eq('status', 'active');

      const runRowsPromise = supabase
        .from('runs')
        .select('distance')
        .eq('club_id', clubId);

      const [rankStats, { data: memberRows }, { data: runRows }] = await Promise.all([
        rankStatsPromise,
        memberRowsPromise,
        runRowsPromise
      ]);

      setRankings(rankStats);

      // Fetch local top clubs if province is available
      const currentProvince = cachedClub?.province || club?.province;
      if (currentProvince) {
        const localData = await fetchTopClubsByArea(5, currentProvince)
        setTopClubsLocal(localData)
      }


      const toPublicUrl = (path: string | null | undefined, bucket: string) => {
        if (!path) return null
        if (isPublicUrl(path)) return path
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        return data.publicUrl || null
      }

      const mappedMembers = (memberRows || []).map((row: any) => ({
        id: row.user_id,
        name: row.profiles?.nickname || 'Unknown',
        avatarUrl: toPublicUrl(row.profiles?.avatar_url, 'avatars'),
        role: (row.role || 'member') as ClubDetailMember['role'],
        level: row.profiles?.level || 1
      }))

      setMembers(mappedMembers)

      const totalDistanceKm = (runRows || []).reduce((sum: number, item: any) => {
        return sum + Number(item.distance || 0)
      }, 0)
      const totalCalories = Math.round(totalDistanceKm * 60)
      // Fix: Prefer actual member list count over cached count which might be out of sync
      const memberCount = mappedMembers.length

      setStats({
        totalDistanceKm,
        totalCalories,
        memberCount
      })
    }

    load()
  }, [clubId, supabase, cachedClub]) // Depend on cachedClub to trigger sync when SWR returns

  const displayTopClubs = rankType === 'global' ? topClubs : topClubsLocal;

  if (isClubLoading && !club) {
    return (
      <div className="w-full h-[300px] flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">正在加载俱乐部详情...</div>
      </div>
    );
  }

  if (clubError && !club) {
    return (
      <div className="w-full h-[300px] flex flex-col items-center justify-center gap-4">
        <div className="text-destructive font-semibold">网络异常，无法加载俱乐部信息</div>
        <div className="text-sm text-muted-foreground">{clubError.message || '请检查网络连接或稍后重试'}</div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>重试</Button>
      </div>
    )
  }

  if (!club) {
    return <div className="p-8 text-center text-foreground">俱乐部信息不存在</div>
  }

  const formatArea = (area: number | undefined) => {
    if (!area) return '0 ㎡';
    if (area < 10000) return `${Math.round(area)} ㎡`;
    return `${(area / 1000000).toFixed(1)} k㎡`;
  };

  return (
    <div
      className="relative w-full h-full flex flex-col bg-background text-foreground"
      style={{
        // ✅ 键盘弹出时向上移动，而不是改变高度
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
        transition: 'padding-bottom 0.3s ease'
      }}
    >
      {/* ✅ 固定高度的可滚动内容区 */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 w-full min-h-0 overflow-y-auto overscroll-contain`}
      >
        <div className="px-6 pt-6">
          <div className="relative h-44 overflow-hidden rounded-2xl border border-border">
            <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/80 to-background" />
            <div className="absolute inset-0 opacity-50">
              {club.avatarUrl ? (
                <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="absolute inset-0 bg-background/40" />
            <div className="absolute left-6 top-4 flex items-center justify-between w-[calc(100%-3rem)] z-10">
              <div className="flex items-center gap-2">
                {onBack && !effectiveIsMember && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-background/40 text-foreground hover:bg-background/60" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </Button>
                )}
              </div>
              {effectiveIsMember && (
                <Button size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold shadow-lg" onClick={() => onChange?.()}>
                  更换
                </Button>
              )}
            </div>
          </div>
          <div className="relative -mt-10 flex items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-background bg-muted">
              {club.avatarUrl ? (
                <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">
                  {club.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="pb-2">
              <div className="text-lg font-semibold text-foreground">{club.name}</div>

              {/* Inline Stats Row */}
              <div className="flex items-center gap-3 text-base font-medium text-muted-foreground mt-1">
                <div className="flex items-center gap-1">
                  <Footprints className="w-4 h-4 text-muted-foreground" />
                  <span>{formatArea(club.totalArea)}</span>
                </div>
                <div className="w-[1px] h-4 bg-border" />
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{stats.memberCount}人</span>
                </div>
              </div>

              {club.description ? (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{club.description}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-6 mt-6">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/30 p-4">
            <div
              className={`text-center border-r border-border flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${rankType === 'global' ? 'bg-background rounded-lg -my-2 py-2 shadow-sm' : 'hover:bg-background/50 rounded-lg -my-2 py-2'}`}
              onClick={() => setRankType('global')}
            >
              <div className={`flex items-center gap-1.5 ${rankType === 'global' ? 'text-primary' : 'text-muted-foreground'} mb-1`}>
                <Trophy className="w-4 h-4" />
                <span className="text-xs font-bold">全国排名</span>
              </div>
              <div className={`text-xl font-black italic ${rankType === 'global' ? 'text-foreground' : 'text-muted-foreground'}`}>#{rankings.global || '-'}</div>
            </div>
            <div
              className={`text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${rankType === 'local' ? 'bg-background rounded-lg -my-2 py-2 shadow-sm' : 'hover:bg-background/50 rounded-lg -my-2 py-2'}`}
              onClick={() => setRankType('local')}
            >
              <div className={`flex items-center gap-1.5 ${rankType === 'local' ? 'text-blue-500' : 'text-muted-foreground'} mb-1`}>
                <Map className="w-4 h-4" />
                <span className="text-xs font-bold">省内排名</span>
              </div>
              <div className={`text-xl font-black italic ${rankType === 'local' ? 'text-foreground' : 'text-muted-foreground'}`}>#{rankings.provincial || '-'}</div>
            </div>
          </div>
        </div>

        {/* ✅ 关键修改：已加入时的 Tabs 内容区域 */}
        {effectiveIsMember ? (
          <div className="px-6 mt-6 pb-4">
            <Tabs defaultValue="members" className="w-full">
              <TabsList className="w-full bg-muted border border-border">
                <TabsTrigger value="activity" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">动态</TabsTrigger>
                <TabsTrigger value="members" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">成员</TabsTrigger>
                <TabsTrigger value="data" className="flex-1 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">数据</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-4">
                <div className="rounded-2xl border border-border bg-muted/30 p-6 text-center text-muted-foreground">
                  暂无俱乐部动态
                </div>
              </TabsContent>

              <TabsContent value="members" className="mt-4">
                {members.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">暂无成员</div>
                ) : (
                  <div className="space-y-4">
                    {/* ✅ 成员列表：固定项高度 */}
                    <div className="space-y-3">
                      {displayMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3 min-h-[72px]">
                          {/* ... 原有成员卡片内容 ... */}
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-full bg-muted">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                                  {member.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-foreground">{member.name}</div>
                              <div className="text-xs text-muted-foreground">Lv.{member.level}</div>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">{roleLabel(member.role)}</div>
                        </div>
                      ))}
                    </div>

                    {/* ✅ 分页控件 */}
                    <div className="flex items-center justify-center pt-4 pb-2 text-sm text-muted-foreground gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                      >
                        ←
                      </Button>
                      <span className="font-medium text-foreground">{currentPage} / {totalPages}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0 rounded-full hover:bg-muted"
                      >
                        →
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="data" className="mt-4">
                {/* ... 原有数据内容 ... */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">总里程</div>
                    <div className="text-lg font-semibold text-foreground">{formatDistance(stats.totalDistanceKm)}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">总消耗</div>
                    <div className="text-lg font-semibold text-foreground">{formatCalories(stats.totalCalories)}</div>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <div className="text-xs text-muted-foreground">总人数</div>
                    <div className="text-lg font-semibold text-foreground">{stats.memberCount.toLocaleString()}</div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="px-6 mt-6 pb-4">
            {/* ... 原有的排行榜内容 completely unchanged ... */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{rankType === 'global' ? '全国' : '省内'}前5名排行榜</h3>
            </div>
            <div className="space-y-3">
              {displayTopClubs.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground bg-muted/30 rounded-2xl border border-border">
                  暂无排行数据
                </div>
              ) : (
                displayTopClubs.map((club, index) => (
                  <div key={club.id} className="flex items-center gap-4 p-3 rounded-2xl bg-muted/30 border border-border">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                          'bg-muted text-muted-foreground'
                      }`}>
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{club.name}</div>
                      <div className="text-xs text-muted-foreground">{club.displayArea}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ✅ 固定底部加入按钮 (非成员时显示) */}
      {!effectiveIsMember && (
        <div
          ref={joinButtonContainerRef}
          className="shrink-0 w-full border-t border-border bg-background px-6 py-4 safe-area-bottom"
        >
          <Button
            className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-base shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
            onClick={handleJoinClick}
            disabled={isJoining}
          >
            {isJoining ? (
              <><Loader2 className="h-5 w-5 animate-spin mr-2" />申请中...</>
            ) : (
              '加入俱乐部'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

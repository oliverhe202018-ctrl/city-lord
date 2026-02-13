'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { getClubDetailsCached } from '@/app/actions/club'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Map, Users, Footprints, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/useGameStore'
import { toast } from 'sonner'
import { Keyboard } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'

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

  // ✅ 新增：监听键盘事件
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const showListener = Keyboard.addListener('keyboardWillShow', (info) => {
      setKeyboardHeight(info.keyboardHeight)
    })

    const hideListener = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0)
    })

    return () => {
      showListener.remove()
      hideListener.remove()
    }
  }, [])

  // Optimized Data Fetching with SWR & Server Action Cache
  const { data: cachedClub, isLoading: isClubLoading } = useSWR(
    clubId ? ['club-details', clubId] : null,
    ([_, id]) => getClubDetailsCached(id),
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
        // Direct Server Action Call
        try {
            const { joinClub } = await import('@/app/actions/club');
            const result = await joinClub(clubId);
            
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
          id: cachedClub.club_id,
          name: cachedClub.name,
          description: cachedClub.description,
          avatarUrl: toPublicUrl(cachedClub.avatar_url, 'clubs'),
          memberCount: cachedClub.member_count || 0,
          province: cachedClub.province,
          totalArea: Number(cachedClub.total_area) || 0
        })
      }

      // 2. Fetch additional details (rankings, members, stats)
      const { getClubRankStats, getTopClubsByArea } = await import('@/app/actions/club');
      
      const rankStatsPromise = getClubRankStats(clubId);
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
          const localData = await getTopClubsByArea(5, currentProvince);
          setTopClubsLocal(localData);
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
      const memberCount = mappedMembers.length > 0 ? mappedMembers.length : (cachedClub?.member_count || 0)

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
      <div className="w-full h-[300px] flex flex-col items-center justify-center bg-black text-white gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
        <div className="text-sm text-white/50">正在加载俱乐部详情...</div>
      </div>
    );
  }

  if (!club) {
    return <div className="p-8 text-center text-white">俱乐部信息不存在</div>
  }

  const formatArea = (area: number | undefined) => {
      if (!area) return '0 ㎡';
      if (area < 10000) return `${Math.round(area)} ㎡`;
      return `${(area / 1000000).toFixed(1)} k㎡`;
  };

  return (
    <div 
      className="relative w-full h-full flex flex-col bg-black text-white"
      style={{
        // ✅ 键盘弹出时向上移动，而不是改变高度
        paddingBottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
        transition: 'padding-bottom 0.3s ease'
      }}
    >
      {/* ✅ 固定高度的可滚动内容区 */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 w-full min-h-0 ${
          effectiveIsMember 
            ? "overflow-y-auto overscroll-contain" 
            : "overflow-y-auto overscroll-contain"
        }`}
      >
        <div className="px-6 pt-6">
          <div className="relative h-44 overflow-hidden rounded-2xl border border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
            <div className="absolute inset-0 opacity-50">
              {club.avatarUrl ? (
                <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute left-6 top-4 flex items-center justify-between w-[calc(100%-3rem)] z-10">
              <div className="flex items-center gap-2">
                {onBack && !effectiveIsMember && (
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-black/40 text-white hover:bg-black/60" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </Button>
                )}
              </div>
              {effectiveIsMember && (
                <Button size="sm" className="rounded-full bg-yellow-500 text-black hover:bg-yellow-400 font-bold shadow-lg" onClick={() => onChange?.()}>
                  更换
                </Button>
              )}
            </div>
          </div>
          <div className="relative -mt-10 flex items-end gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-white/10 bg-zinc-800">
              {club.avatarUrl ? (
                <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                  {club.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="pb-2">
              <div className="text-lg font-semibold text-white">{club.name}</div>
              
              {/* Inline Stats Row */}
              <div className="flex items-center gap-3 text-base font-medium text-zinc-300 mt-1">
                <div className="flex items-center gap-1">
                  <Footprints className="w-4 h-4 text-zinc-400" />
                  <span>{formatArea(club.totalArea)}</span>
                </div>
                <div className="w-[1px] h-4 bg-zinc-700" />
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>{stats.memberCount}人</span>
                </div>
              </div>

              {club.description ? (
                <div className="text-xs text-white/60 mt-1 line-clamp-1">{club.description}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-6 mt-6">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
            <div 
                className={`text-center border-r border-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${rankType === 'global' ? 'bg-white/5 rounded-lg -my-2 py-2' : 'hover:bg-white/5 rounded-lg -my-2 py-2'}`}
                onClick={() => setRankType('global')}
            >
              <div className={`flex items-center gap-1.5 ${rankType === 'global' ? 'text-yellow-500' : 'text-zinc-500'} mb-1`}>
                <Trophy className="w-4 h-4" />
                <span className="text-xs font-bold">全国排名</span>
              </div>
              <div className={`text-xl font-black italic ${rankType === 'global' ? 'text-white' : 'text-zinc-500'}`}>#{rankings.global || '-'}</div>
            </div>
            <div 
                className={`text-center flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${rankType === 'local' ? 'bg-white/5 rounded-lg -my-2 py-2' : 'hover:bg-white/5 rounded-lg -my-2 py-2'}`}
                onClick={() => setRankType('local')}
            >
              <div className={`flex items-center gap-1.5 ${rankType === 'local' ? 'text-blue-400' : 'text-zinc-500'} mb-1`}>
                <Map className="w-4 h-4" />
                <span className="text-xs font-bold">省内排名</span>
              </div>
              <div className={`text-xl font-black italic ${rankType === 'local' ? 'text-white' : 'text-zinc-500'}`}>#{rankings.provincial || '-'}</div>
            </div>
          </div>
        </div>

        {/* ✅ 关键修改：已加入时的 Tabs 内容区域 */}
        {effectiveIsMember ? (
          <div className="px-6 mt-6 pb-4">
            <Tabs defaultValue="members" className="w-full">
              <TabsList className="w-full bg-zinc-900/70 border border-white/10">
                <TabsTrigger value="activity" className="flex-1">动态</TabsTrigger>
                <TabsTrigger value="members" className="flex-1">成员</TabsTrigger>
                <TabsTrigger value="data" className="flex-1">数据</TabsTrigger>
              </TabsList>
              
              <TabsContent value="activity" className="mt-4">
                <div className="rounded-2xl border border-white/5 bg-zinc-900/60 p-6 text-center text-white/50">
                  暂无俱乐部动态
                </div>
              </TabsContent>

              <TabsContent value="members" className="mt-4">
                {members.length === 0 ? (
                  <div className="py-8 text-center text-white/50">暂无成员</div>
                ) : (
                  <div className="space-y-4">
                    {/* ✅ 成员列表：固定项高度 */}
                    <div className="space-y-3">
                      {displayMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/60 px-4 py-3 min-h-[72px]">
                          {/* ... 原有成员卡片内容 ... */}
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-800">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                                  {member.name.slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white">{member.name}</div>
                              <div className="text-xs text-white/50">Lv.{member.level}</div>
                            </div>
                          </div>
                          <div className="text-xs text-white/60">{roleLabel(member.role)}</div>
                        </div>
                      ))}
                    </div>

                    {/* ✅ 分页控件 */}
                    <div className="flex items-center justify-center pt-4 pb-2 text-sm text-white/50 gap-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1} 
                        className="h-8 w-8 p-0 rounded-full hover:bg-white/10"
                      >
                        ←
                      </Button>
                      <span className="font-medium text-white/70">{currentPage} / {totalPages}</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages} 
                        className="h-8 w-8 p-0 rounded-full hover:bg-white/10"
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
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                    <div className="text-xs text-white/50">总里程</div>
                    <div className="text-lg font-semibold text-white">{formatDistance(stats.totalDistanceKm)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                    <div className="text-xs text-white/50">总消耗</div>
                    <div className="text-lg font-semibold text-white">{formatCalories(stats.totalCalories)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                    <div className="text-xs text-white/50">总人数</div>
                    <div className="text-lg font-semibold text-white">{stats.memberCount.toLocaleString()}</div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="px-6 mt-6 pb-4">
            {/* ... 原有的排行榜内容 completely unchanged ... */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">{rankType === 'global' ? '全国' : '省内'}前5名排行榜</h3>
            </div>
            <div className="space-y-3">
              {displayTopClubs.length === 0 ? (
                <div className="py-8 text-center text-white/30 bg-zinc-900/30 rounded-2xl border border-white/5">
                  暂无排行数据
                </div>
              ) : (
                displayTopClubs.map((club, index) => (
                  <div key={club.id} className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-900/60 border border-white/5">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500 text-black' : 
                      index === 1 ? 'bg-gray-300 text-black' : 
                      index === 2 ? 'bg-orange-700 text-white' : 
                      'bg-zinc-800 text-white/50'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                       <img src={club.avatar} alt={club.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{club.name}</div>
                      <div className="text-xs text-white/50">{club.displayArea}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ✅ 固定底部按钮（未加入时） */}
      {!effectiveIsMember && onJoin && (
        <div
          className="flex-shrink-0 p-4 bg-zinc-950/95 backdrop-blur border-t border-white/10 z-50"
          style={{
            // ✅ 安全区域适配
            paddingBottom: `calc(1rem + env(safe-area-inset-bottom))`
          }}
        >
           <Button 
            size="lg" 
            className="w-full py-6 text-lg font-bold bg-yellow-500 text-black hover:bg-yellow-400 shadow-xl rounded-xl"
            onClick={handleJoinClick}
            disabled={isJoining}
           >
            {isJoining ? "申请中..." : "申请加入"}
           </Button>
        </div>
      )}
    </div>
  )
}

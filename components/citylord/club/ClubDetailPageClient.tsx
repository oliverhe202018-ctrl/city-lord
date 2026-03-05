"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Settings, RefreshCw } from 'lucide-react'

type ClubDetailMember = {
  id: string
  name: string
  avatarUrl?: string | null
  role: 'owner' | 'vice_president' | 'admin' | 'elite' | 'member'
  level: number
}

type ClubDetailStats = {
  totalDistanceKm: number
  totalCalories: number
  memberCount: number
}

type ClubDetailInfo = {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  totalArea?: number | null
}

interface ClubDetailPageClientProps {
  club: ClubDetailInfo
  stats: ClubDetailStats
  members: ClubDetailMember[]
  currentUserRole?: 'owner' | 'vice_president' | 'admin' | 'elite' | 'member' | null
}

function formatDistance(value: number) {
  return `${value.toFixed(1)} km`
}

function formatCalories(value: number) {
  return `${value.toLocaleString()} kcal`
}

function roleLabel(role: ClubDetailMember['role']) {
  if (role === 'owner') return '会长'
  if (role === 'vice_president') return '副会长'
  if (role === 'admin') return '管理员'
  if (role === 'elite') return '精英'
  return '成员'
}

function roleBadgeColor(role: ClubDetailMember['role']) {
  if (role === 'owner') return 'text-yellow-400'
  if (role === 'vice_president') return 'text-orange-400'
  if (role === 'admin') return 'text-blue-400'
  if (role === 'elite') return 'text-purple-400'
  return 'text-white/50'
}

function ClubHeader({ club, currentUserRole, onBack }: { club: ClubDetailInfo; currentUserRole?: string | null; onBack: () => void }) {
  const router = useRouter()
  const showChangeBtn = currentUserRole && currentUserRole !== 'owner'

  return (
    <div className="px-4 pt-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        {showChangeBtn && (
          <Button
            size="sm"
            variant="outline"
            className="border-white/10 text-white/60 hover:bg-white/10 h-7 text-xs"
            onClick={() => router.push('/clubs')}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            更换
          </Button>
        )}
      </div>

      <div className="relative h-36 overflow-hidden rounded-xl border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
        <div className="absolute inset-0 opacity-50">
          {club.avatarUrl ? (
            <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute left-4 bottom-4">
          <div className="text-lg font-bold text-white">{club.name}</div>
          {club.description ? (
            <div className="text-xs text-white/60 mt-0.5 line-clamp-1">{club.description}</div>
          ) : null}
        </div>
      </div>

      <div className="relative -mt-8 ml-3 flex items-end gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-black bg-zinc-800 shadow-lg">
          {club.avatarUrl ? (
            <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
              {club.name.slice(0, 1)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ClubStats({ stats }: { stats: ClubDetailStats }) {
  return (
    <div className="px-4 mt-4">
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-zinc-900/60 p-3">
        <div className="text-center">
          <div className="text-base font-bold text-white">{formatDistance(stats.totalDistanceKm)}</div>
          <div className="text-[10px] text-white/50">总里程</div>
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-white">{formatCalories(stats.totalCalories)}</div>
          <div className="text-[10px] text-white/50">总消耗</div>
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-white">{stats.memberCount.toLocaleString()}</div>
          <div className="text-[10px] text-white/50">总人数</div>
        </div>
      </div>
    </div>
  )
}

function MemberList({ members }: { members: ClubDetailMember[] }) {
  if (members.length === 0) {
    return <div className="py-8 text-center text-white/50 text-sm">暂无成员</div>
  }

  // Sort: owner first, then vice_president, admin, elite, member
  const roleOrder: Record<string, number> = { owner: 0, vice_president: 1, admin: 2, elite: 3, member: 4 }
  const sorted = [...members].sort((a, b) => (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99))

  return (
    <div className="space-y-2">
      {sorted.map((member) => (
        <div key={member.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/60 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-800">
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
              <div className="text-[10px] text-white/40">Lv.{member.level}</div>
            </div>
          </div>
          <div className={`text-xs font-medium ${roleBadgeColor(member.role)}`}>{roleLabel(member.role)}</div>
        </div>
      ))}
    </div>
  )
}

function ClubDataSummary({ stats, clubId, canManage }: { stats: ClubDetailStats; clubId: string; canManage: boolean }) {
  const router = useRouter()

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
          <div className="text-[10px] text-white/50">总里程</div>
          <div className="text-base font-semibold text-white">{formatDistance(stats.totalDistanceKm)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
          <div className="text-[10px] text-white/50">总消耗</div>
          <div className="text-base font-semibold text-white">{formatCalories(stats.totalCalories)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3">
          <div className="text-[10px] text-white/50">总人数</div>
          <div className="text-base font-semibold text-white">{stats.memberCount.toLocaleString()}</div>
        </div>
      </div>

      {canManage && (
        <Button
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400 font-medium"
          onClick={() => router.push(`/clubs/manage?id=${clubId}`)}
        >
          <Settings className="w-4 h-4 mr-2" />
          俱乐部管理
        </Button>
      )}
    </div>
  )
}

export function ClubDetailPageClient({ club, stats, members, currentUserRole }: ClubDetailPageClientProps) {
  const canManage = currentUserRole === 'owner' || currentUserRole === 'vice_president'

  return (
    <div className="min-h-screen bg-black text-white">
      <ClubHeader club={club} currentUserRole={currentUserRole} onBack={() => window.history.back()} />
      <ClubStats stats={stats} />
      <div className="px-4 mt-4 pb-10">
        <Tabs defaultValue="members" className="w-full">
          <TabsList className="w-full bg-zinc-900/70 border border-white/10">
            <TabsTrigger value="activity" className="flex-1 text-xs">动态</TabsTrigger>
            <TabsTrigger value="members" className="flex-1 text-xs">成员</TabsTrigger>
            <TabsTrigger value="data" className="flex-1 text-xs">数据</TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="mt-3">
            <div className="rounded-xl border border-white/5 bg-zinc-900/60 p-6 text-center text-white/50 text-sm">
              暂无俱乐部动态
            </div>
          </TabsContent>
          <TabsContent value="members" className="mt-3">
            <MemberList members={members} />
          </TabsContent>
          <TabsContent value="data" className="mt-3">
            <ClubDataSummary stats={stats} clubId={club.id} canManage={canManage} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

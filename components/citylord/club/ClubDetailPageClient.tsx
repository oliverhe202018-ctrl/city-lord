"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

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

function ClubHeader({ club }: { club: ClubDetailInfo }) {
  return (
    <div className="px-6 pt-6">
      <div className="relative h-44 overflow-hidden rounded-2xl border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />
        <div className="absolute inset-0 opacity-50">
          {club.avatarUrl ? (
            <img src={club.avatarUrl} alt={club.name} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute left-6 top-4 flex items-center justify-between w-[calc(100%-3rem)]">
          <div className="text-xl font-bold text-white">{club.name}</div>
          <Button size="sm" className="rounded-full bg-yellow-500 text-black hover:bg-yellow-400">
            加入
          </Button>
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
          {club.description ? (
            <div className="text-xs text-white/60">{club.description}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ClubStats({ stats }: { stats: ClubDetailStats }) {
  return (
    <div className="px-6 mt-6">
      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        <div className="text-center">
          <div className="text-lg font-bold text-white">{formatDistance(stats.totalDistanceKm)}</div>
          <div className="text-xs text-white/50">总里程</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{formatCalories(stats.totalCalories)}</div>
          <div className="text-xs text-white/50">总消耗</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-white">{stats.memberCount.toLocaleString()}</div>
          <div className="text-xs text-white/50">总人数</div>
        </div>
      </div>
    </div>
  )
}

function MemberList({ members }: { members: ClubDetailMember[] }) {
  if (members.length === 0) {
    return <div className="py-8 text-center text-white/50">暂无成员</div>
  }

  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/60 px-4 py-3">
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
  )
}

function ClubDataSummary({ stats }: { stats: ClubDetailStats }) {
  return (
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
  )
}

export function ClubDetailPageClient({ club, stats, members }: ClubDetailPageClientProps) {
  return (
    <div className="min-h-screen bg-black text-white border-4 border-red-500">
      <ClubHeader club={club} />
      <ClubStats stats={stats} />
      <div className="px-6 mt-6 pb-10">
        <Tabs defaultValue="activity" className="w-full">
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
            <MemberList members={members} />
          </TabsContent>
          <TabsContent value="data" className="mt-4">
            <ClubDataSummary stats={stats} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

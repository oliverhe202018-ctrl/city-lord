'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRegion } from '@/contexts/RegionContext'
import { Users, MapPin, CheckCircle2, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

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

const getClubs = async () => {
  const res = await fetchWithTimeout('/api/club/get-clubs', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch clubs')
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

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function ClubList() {
  const { region } = useRegion()
  const { province, cityName, countyName } = region || {}
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const supabase = useMemo(() => createClient(), [])

  // 获取位置名称，避免 undefined
  const locationName = cityName || countyName || '城市'

  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: getClubs,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Derive joined status from clubs data
  const joinedClubs = useMemo(() => {
    const set = new Set<string>()
    clubs.forEach((club: any) => {
      if (club.isJoined) set.add(club.id)
    })
    return set
  }, [clubs])

  const clubsWithAvatars = useMemo(() => {
    return clubs.map((club: any) => {
      const avatar = club.avatar
      if (!avatar || /^https?:\/\//i.test(avatar) || avatar.startsWith('data:')) {
        return { ...club, displayAvatar: avatar }
      }
      const { data } = supabase.storage.from('clubs').getPublicUrl(avatar)
      return { ...club, displayAvatar: data.publicUrl }
    })
  }, [clubs, supabase])

  const joinMutation = useMutation({
    mutationFn: joinClub,
    onSuccess: (res, clubId) => {
      if (res.success) {
        if (res.status === 'active') {
             toast({ title: '加入成功', description: '你已成功加入该俱乐部！' })
        } else {
             toast({ title: '申请已提交', description: '已申请加入俱乐部，请等待审核。' })
        }
        // Invalidate to refetch and get updated isJoined status
        queryClient.invalidateQueries({ queryKey: ['clubs'] })
      }
    },
    onError: (error: any) => {
      toast({ 
        title: '申请失败', 
        description: error.message || '未知错误',
        variant: 'destructive'
      })
    }
  })

  const handleJoinClub = async (clubId: string, clubName: string) => {
    if (joinedClubs.has(clubId)) {
      toast({ title: '提示', description: `你已经是 ${clubName} 的成员了！` })
      return
    }

    const confirm = window.confirm(`确定要申请加入 ${clubName} 吗？`)
    if (confirm) {
       joinMutation.mutate(clubId)
    }
  }

  const handleViewClub = (clubId: string, clubName: string) => {
    toast({ title: '提示', description: `查看 ${clubName} 详情功能开发中...` })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-white/50">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 text-white h-full overflow-auto">
      <h2 className="text-2xl font-bold mb-4">选择跑步俱乐部</h2>

      {clubs.length === 0 ? (
        <div className="text-center py-10 text-white/50">
          <p>暂无俱乐部</p>
          <p className="text-sm mt-2">你可以创建一个新的俱乐部！</p>
        </div>
      ) : (
        <div className="space-y-3 pb-20">
          {clubsWithAvatars.map((club: any) => (
            <div
              key={club.id}
              onClick={() => handleViewClub(club.id, club.name)}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 cursor-pointer transition-colors"
            >
              <img src={club.displayAvatar || club.avatar} alt={club.name} className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2 truncate">
                  {club.name}
                  {joinedClubs.has(club.id) && (
                    <span className="flex items-center gap-1 text-green-400 text-xs flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      已申请
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/60 flex items-center gap-3 sm:gap-4">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span>{club.members} 位成员</span>
                  </span>
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span>{club.territory}</span>
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant={joinedClubs.has(club.id) ? "secondary" : "outline"}
                onClick={(e) => {
                  e.stopPropagation()
                  handleJoinClub(club.id, club.name)
                }}
                disabled={joinedClubs.has(club.id) || joinMutation.isPending}
                className={`h-8 text-xs ${
                   !joinedClubs.has(club.id) ? "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10" : ""
                }`}
              >
                {joinedClubs.has(club.id) ? '已申请' : (joinMutation.isPending && joinMutation.variables === club.id ? '...' : '加入')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

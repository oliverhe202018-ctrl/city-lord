'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClubDetailPageClient } from '@/components/citylord/club/ClubDetailPageClient'
import { getClubDetailsById } from '@/app/actions/club'
import { Loader2 } from 'lucide-react'

function isPublicUrl(value?: string | null) {
  return !!value && (/^https?:\/\//i.test(value) || value.startsWith('data:'))
}

function ClubDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!id) {
      setError(true)
      setLoading(false)
      return
    }

    getClubDetailsById(id).then(res => {
      if (!res) {
        setError(true)
      } else {
        setData(res)
      }
      setLoading(false)
    }).catch(e => {
      console.error(e)
      setError(true)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return <div className="h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>
  }

  if (error || !data) {
    return <div className="h-screen bg-black flex items-center justify-center text-white">无法加载俱乐部信息</div>
  }

  const { club, members, distanceAgg, memberCount } = data

  const toPublicUrl = (path: string | null | undefined, bucket: string) => {
    if (!path) return null
    if (isPublicUrl(path)) return path
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl || null
  }

  const totalDistanceKm = Number(distanceAgg?._sum?.distance || 0)
  const totalCalories = Math.round(totalDistanceKm * 60)

  const memberItems = members.map((member: any) => ({
    id: member.user_id,
    name: member.profiles?.nickname || 'Unknown',
    avatarUrl: toPublicUrl(member.profiles?.avatar_url, 'avatars'),
    role: (member.role || 'member') as 'owner' | 'admin' | 'member',
    level: member.profiles?.level || 1
  }))

  return (
    <ClubDetailPageClient
      club={{
        id: club.id,
        name: club.name,
        description: club.description,
        avatarUrl: toPublicUrl(club.avatar_url, 'clubs'),
        totalArea: club.total_area ? Number(club.total_area) : null
      }}
      stats={{
        totalDistanceKm,
        totalCalories,
        memberCount
      }}
      members={memberItems}
    />
  )
}

export default function ClubDetailPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center text-white"><Loader2 className="animate-spin w-8 h-8" /></div>}>
      <ClubDetailContent />
    </Suspense>
  )
}

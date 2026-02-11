import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { ClubDetailPageClient } from '@/components/citylord/club/ClubDetailPageClient'

type PageProps = {
  params: {
    id: string
  }
}

function isPublicUrl(value?: string | null) {
  return !!value && (/^https?:\/\//i.test(value) || value.startsWith('data:'))
}

export default async function ClubDetailPage({ params }: PageProps) {
  const clubId = params.id
  const club = await prisma.clubs.findUnique({
    where: { id: clubId },
    select: {
      id: true,
      name: true,
      description: true,
      avatar_url: true,
      total_area: true
    }
  })

  if (!club) {
    notFound()
  }

  const [members, distanceAgg, memberCount] = await Promise.all([
    prisma.club_members.findMany({
      where: { club_id: clubId, status: 'active' },
      include: {
        profiles: {
          select: {
            id: true,
            nickname: true,
            avatar_url: true,
            level: true
          }
        }
      },
      orderBy: { joined_at: 'asc' }
    }),
    prisma.runs.aggregate({
      where: { club_id: clubId },
      _sum: { distance: true }
    }),
    prisma.club_members.count({
      where: { club_id: clubId, status: 'active' }
    })
  ])

  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const toPublicUrl = (path: string | null | undefined, bucket: string) => {
    if (!path) return null
    if (isPublicUrl(path)) return path
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl || null
  }

  const totalDistanceKm = Number(distanceAgg._sum.distance || 0)
  const totalCalories = Math.round(totalDistanceKm * 60)

  const memberItems = members.map((member) => ({
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

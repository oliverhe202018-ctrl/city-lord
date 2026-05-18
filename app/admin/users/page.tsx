import { prisma } from '@/lib/prisma'
import AdminEnhancedUsersPageClient from '@/components/admin/AdminEnhancedUsersPageClient'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const profiles = await prisma.profiles.findMany({
    orderBy: {
      created_at: 'desc',
    },
    take: 100,
  })

  return (
    <AdminEnhancedUsersPageClient
      initialProfiles={profiles}
    />
  )
}

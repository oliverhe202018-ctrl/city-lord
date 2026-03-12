import AdminUsersPageClient from '@/components/admin/AdminUsersPageClient'
import { getAdminUsers } from '@/app/actions/admin'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const res = await getAdminUsers()

  return (
    <AdminUsersPageClient
      initialProfiles={res.success ? res.data : []}
      initialError={res.success ? null : res.error}
    />
  )
}

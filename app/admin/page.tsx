export const dynamic = 'force-dynamic'

import AdminDashboardPageClient from '@/components/admin/AdminDashboardPageClient'
import { getAdminDashboardData } from '@/app/actions/admin'

export default async function AdminDashboardPage() {
  const res = await getAdminDashboardData()

  return (
    <AdminDashboardPageClient
      // @ts-expect-error - FIXME: Type '{ summary: { total_users: number; total_clubs: number; pending_a
      initialData={res.success ? res.data : null}
      initialError={res.success ? null : res.error}
    />
  )
}

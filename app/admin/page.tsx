import AdminDashboardPageClient from '@/components/admin/AdminDashboardPageClient'
import { getAdminDashboardData } from '@/app/actions/admin'

export default async function AdminDashboardPage() {
  const res = await getAdminDashboardData()

  return (
    <AdminDashboardPageClient
      initialData={res.success ? res.data : null}
      initialError={res.success ? null : res.error}
    />
  )
}

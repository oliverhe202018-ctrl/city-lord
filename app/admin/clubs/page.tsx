import ClubAuditPageClient from '@/components/admin/ClubAuditPageClient'
import { getApprovedClubs, getPendingClubs } from '@/app/actions/club'

export default async function AdminClubsPage() {
  const [pendingRes, approvedRes] = await Promise.all([getPendingClubs(), getApprovedClubs()])

  const initialError = !pendingRes.success
    ? `获取待审核列表失败: ${pendingRes.error}`
    : !approvedRes.success
      ? `获取已通过列表失败: ${approvedRes.error}`
      : null

  return (
    <ClubAuditPageClient
      initialPendingClubs={pendingRes.success ? pendingRes.data : []}
      initialApprovedClubs={approvedRes.success ? approvedRes.data : []}
      initialError={initialError}
    />
  )
}

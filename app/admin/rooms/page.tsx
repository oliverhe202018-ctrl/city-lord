export const dynamic = 'force-dynamic'

import AdminRoomsPageClient from '@/components/admin/AdminRoomsPageClient'
import { getAdminRooms } from '@/app/actions/admin'

export default async function RoomsPage() {
  const res = await getAdminRooms()

  const initialRooms = res.success
    ? (res.data || []).map((room: any) => ({
      ...room,
      participants_count: room.participants?.[0]?.count || 0,
      host_profile: Array.isArray(room.host_profile) ? room.host_profile[0] : room.host_profile,
    }))
    : []

  return (
    <AdminRoomsPageClient
      initialRooms={initialRooms}
      initialError={res.success ? null : res.error}
    />
  )
}

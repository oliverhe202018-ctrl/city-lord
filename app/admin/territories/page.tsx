import { prisma } from '@/lib/prisma'
import { getAdminTerritories } from '@/app/actions/admin/territories'
import AdminTerritoriesPageClient from '@/components/admin/AdminTerritoriesPageClient'

export const dynamic = 'force-dynamic'

export default async function AdminTerritoriesPage() {
  const territoriesRes = await getAdminTerritories()
  const cities = await prisma.cities.findMany({
    select: {
      id: true,
      name: true,
    },
  })

  return (
    <AdminTerritoriesPageClient
      initialTerritories={territoriesRes.data || []}
      initialTotal={territoriesRes.total || 0}
      initialCities={cities}
    />
  )
}

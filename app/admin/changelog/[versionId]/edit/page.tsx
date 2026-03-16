import { redirect } from 'next/navigation'
import { getVersionWithItems } from '@/app/actions/admin/changelog-actions'
import { AdminVisualEditor } from '../../AdminVisualEditor'

export default async function AdminChangelogEditPage({
    params,
}: {
    params: Promise<{ versionId: string }>
}) {
    const { versionId } = await params
    const { data, error } = await getVersionWithItems(versionId)

    if (error || !data) redirect('/admin/changelog')

    return <AdminVisualEditor initialData={data} />
}

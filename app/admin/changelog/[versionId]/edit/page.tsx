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

    const initialData = {
        ...data,
        release_date: data.release_date instanceof Date ? data.release_date.toISOString() : data.release_date
    }

    return <AdminVisualEditor initialData={initialData as any} />

}

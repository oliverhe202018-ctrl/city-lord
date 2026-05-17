import { getAdminChangelogs } from '@/app/actions/admin/changelog-actions'
import { AdminChangelogClient } from './AdminChangelogClient'

export default async function AdminChangelogPage() {
    const { data, error } = await getAdminChangelogs()
    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">版本日志管理</h1>
                <p className="text-sm text-muted-foreground">管理应用各版本的功能更新说明</p>
            </div>
            {error ? (
                <p className="text-sm text-destructive">加载失败：{error}</p>
            ) : (
                <AdminChangelogClient initialVersions={data ?? []} />
            )}
        </div>
    )
}

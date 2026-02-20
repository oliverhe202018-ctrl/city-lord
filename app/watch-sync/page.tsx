import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WatchSyncPanel from '@/components/watch-sync/WatchSyncPanel';

export const metadata = {
    title: '智能手表数据同步 - City Lord',
    description: '导入智能手表跑步数据，自动识别闭环轨迹并划定领地',
};

export default async function WatchSyncPage() {
    // Auth guard — redirect to login if not authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return (
        <main className="min-h-screen bg-background p-4 md:p-8">
            <div className="mx-auto max-w-4xl space-y-6">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        ⌚ 智能手表数据同步
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        导入手表/运动手环的跑步记录，系统将自动识别闭合轨迹并尝试划定领地
                    </p>
                </div>

                {/* Main Panel — Client Component */}
                <Suspense fallback={
                    <div className="h-96 animate-pulse rounded-xl bg-muted/50" />
                }>
                    <WatchSyncPanel />
                </Suspense>
            </div>
        </main>
    );
}

'use client'

import React, { useEffect, useState } from 'react'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { StatsGrid } from '@/components/profile/StatsGrid'
import { RunHistoryList } from '@/components/profile/RunHistoryList'
import { Skeleton } from '@/components/ui/skeleton'
import { getProfileData, type ProfileDataResult, type ProfileStats } from '@/app/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function MyProfilePage() {
    const router = useRouter()
    const [profileData, setProfileData] = useState<ProfileDataResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.user) {
                router.replace('/login')
                return
            }
            setUserId(session.user.id)
            try {
                const data = await getProfileData(session.user.id)
                setProfileData(data)
            } catch (e) {
                console.error('Failed to load profile:', e)
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [router])

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-background">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-4">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <Skeleton className="h-6 w-40" />
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-20 rounded-2xl" />
                        ))}
                    </div>
                    <Skeleton className="h-40 rounded-2xl" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                </div>
            </div>
        )
    }

    // Guard: no profile data loaded (DB reset / user not found)
    if (!profileData || !userId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
                <p className="text-lg mb-4">找不到用户资料</p>
                <p className="text-sm text-muted-foreground">请尝试重新登录或联系管理员</p>
                <button
                    onClick={() => router.replace('/login')}
                    className="mt-6 px-4 py-2 rounded-full bg-cyan-500 text-white text-sm hover:bg-cyan-600 transition-colors"
                >
                    重新登录
                </button>
            </div>
        )
    }

    // Build safe data with defaults — handles both isPrivate and isPublic variants
    const user = profileData.user
    const isSelf = profileData.isPrivate ? false : profileData.isSelf
    const isProfilePublic = profileData.isPrivate ? false : (profileData.isProfilePublic ?? true)
    const stats = profileData.isPrivate ? null : (profileData.stats ?? null)

    const safeStats = stats ? {
        ...stats,
        following: stats.following ?? 0,
        followers: stats.followers ?? 0,
        totalRuns: stats.totalRuns ?? 0,
        totalDistanceKm: stats.totalDistanceKm ?? 0,
        likeCount: stats.likeCount ?? 0,
        isLikedByMe: stats.isLikedByMe ?? false,
        personalBests: stats.personalBests ?? [],
        weeklyDistances: stats.weeklyDistances ?? [],
    } : null

    return (
        <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
            {/* Header Fixed */}
            <div className="flex-none sticky top-0 z-20 flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-lg border-b border-border/10">
                <button
                    onClick={() => {
                        // Intelligent back navigation
                        if (window.history.length > 1) {
                            router.back();
                        } else {
                            router.replace('/');
                        }
                    }}
                    className="p-1 rounded-full hover:bg-muted/20 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <span className="text-sm font-medium text-foreground">个人主页</span>
            </div>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto pb-20">
                <ProfileHeader
                    user={user}
                    isSelf={true}
                    isProfilePublic={isProfilePublic}
                    followingCount={safeStats?.following ?? 0}
                    followersCount={safeStats?.followers ?? 0}
                />

                <StatsGrid stats={safeStats} />

                <RunHistoryList userId={userId} />
            </main>
        </div>
    )
}

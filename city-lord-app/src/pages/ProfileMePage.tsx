import React, { useEffect, useState } from 'react'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { StatsGrid } from '@/components/profile/StatsGrid'
import { RunHistoryList } from '@/components/profile/RunHistoryList'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { rpcCall } from '@/api/client'

export default function ProfileMePage() {
    const navigate = useNavigate()
    const { user } = useStore()
    const [profileData, setProfileData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const init = async () => {
            if (!user?.id) {
                navigate('/login', { replace: true })
                return
            }
            try {
                const res = await rpcCall('profile', 'getProfileData', [user.id])
                if (res.success && res.data) {
                    setProfileData(res.data)
                }
            } catch (e) {
                console.error('Failed to load profile:', e)
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [user, navigate])

    if (loading) {
        return (
            <div className="flex flex-col h-[100dvh] w-full absolute top-0 left-0 z-50 bg-background text-foreground">
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

    if (!profileData || !user?.id) {
        return (
            <div className="flex flex-col items-center justify-center h-[100dvh] w-full absolute top-0 left-0 z-50 bg-background text-foreground">
                <p className="text-lg mb-4">找不到用户资料</p>
                <p className="text-sm text-muted-foreground">请尝试重新登录或联系管理员</p>
                <button
                    onClick={() => navigate('/login', { replace: true })}
                    className="mt-6 px-4 py-2 rounded-full bg-cyan-500 text-white text-sm hover:bg-cyan-600 transition-colors"
                >
                    重新登录
                </button>
            </div>
        )
    }

    const profileUser = profileData.user
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
        <div className="flex flex-col h-[100dvh] w-full absolute top-0 left-0 z-50 overflow-hidden bg-background">
            {/* Header Fixed */}
            <div className="flex-none sticky top-0 z-[60] flex items-center gap-2 px-4 pt-[calc(var(--safe-top,0px)+8px)] pb-2 bg-background/80 backdrop-blur-lg border-b border-border/10">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1 rounded-full hover:bg-muted/20 transition-colors pointer-events-auto"
                >
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <span className="text-sm font-medium text-foreground">全部记录</span>
            </div>

            {/* Scrollable Content */}
            <main className="flex-1 overflow-y-auto pb-20 pointer-events-auto">
                <ProfileHeader
                    user={profileUser}
                    isSelf={true}
                    isProfilePublic={isProfilePublic}
                    followingCount={safeStats?.following ?? 0}
                    followersCount={safeStats?.followers ?? 0}
                />

                <StatsGrid stats={safeStats} />

                <RunHistoryList userId={user.id} />
            </main>
        </div>
    )
}

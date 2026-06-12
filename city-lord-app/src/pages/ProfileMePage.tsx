import React, { useEffect, useState } from 'react'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { StatsGrid } from '@/components/profile/StatsGrid'
import { RunHistoryList } from '@/components/profile/RunHistoryList'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { apiFetch } from '@/lib/fetch-shim'
import { Button } from '@/components/ui/button'


export default function ProfileMePage() {
    const navigate = useNavigate()
    const { userId, profile } = useStore()
    const [profileData, setProfileData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const init = async () => {
            if (!userId) {
                navigate('/login', { replace: true })
                return
            }
            try {
                const res = await apiFetch(`/api/v1/user/profile?userId=${userId}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.success && data.data) {
                        setProfileData({ user: data.data.user, stats: data.data.stats, isProfilePublic: data.data.is_profile_public ?? true, isPrivate: data.data.isPrivate })
                    } else {
                        setProfileData(null)
                    }
                }
            } catch (e) {
                console.error('Failed to fetch profile:', e)
                setProfileData(null)
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [userId, navigate])

    if (loading) {
        return (
            <div className="flex flex-col h-[100dvh] w-full fixed inset-0 z-[100] bg-background text-foreground">
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

    if (!profileData || !userId) {
        return (
            <div className="flex flex-col items-center justify-center h-[100dvh] w-screen fixed inset-0 z-[100] bg-background text-foreground">
                <p className="text-lg mb-4">找不到用户资料</p>
                <Button onClick={() => window.history.back()} variant="outline">返回</Button>
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
        <div className="flex flex-col h-[100dvh] w-full fixed inset-0 z-[100] overflow-hidden bg-background">
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

                <RunHistoryList userId={userId} />
            </main>
        </div>
    )
}

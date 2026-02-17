'use client'

import React, { useEffect, useState, useCallback, useTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { StatsGrid } from '@/components/profile/StatsGrid'
import { RunHistoryList } from '@/components/profile/RunHistoryList'
import { Skeleton } from '@/components/ui/skeleton'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    getProfileData,
    toggleUserLike,
    blockUser,
    type ProfileDataResult,
} from '@/app/actions/profile'
import { sendFriendRequest } from '@/app/actions/social'
import { toast } from 'sonner'
import { ArrowLeft, MoreHorizontal, ShieldBan, UserPlus, Lock } from 'lucide-react'

export default function UserProfilePage() {
    const params = useParams()
    const router = useRouter()
    const userId = params.userId as string
    const [profileData, setProfileData] = useState<ProfileDataResult | null>(null)
    const [loading, setLoading] = useState(true)
    const [likeCount, setLikeCount] = useState(0)
    const [isLiked, setIsLiked] = useState(false)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (!userId) return
        loadProfile()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    const loadProfile = async () => {
        setLoading(true)
        try {
            const data = await getProfileData(userId)
            setProfileData(data)
            if (!data.isPrivate) {
                setLikeCount(data.stats.likeCount)
                setIsLiked(data.stats.isLikedByMe)
            }
        } catch (e) {
            console.error('Failed to load user profile:', e)
        } finally {
            setLoading(false)
        }
    }

    // Optimistic like toggle
    const handleToggleLike = useCallback(() => {
        const newLiked = !isLiked
        setIsLiked(newLiked)
        setLikeCount(prev => newLiked ? prev + 1 : Math.max(0, prev - 1))

        startTransition(async () => {
            const result = await toggleUserLike(userId)
            if (result.success) {
                setLikeCount(result.likeCount!)
                setIsLiked(result.liked!)
            } else {
                // Revert
                setIsLiked(!newLiked)
                setLikeCount(prev => newLiked ? Math.max(0, prev - 1) : prev + 1)
                toast.error(result.error || '操作失败')
            }
        })
    }, [isLiked, userId])

    const handleFollow = useCallback(() => {
        startTransition(async () => {
            const result = await sendFriendRequest(userId)
            if (result.success) {
                toast.success('已发送关注请求')
            } else {
                toast.error(result.message || '关注失败')
            }
        })
    }, [userId])

    const handleBlock = useCallback(() => {
        startTransition(async () => {
            const result = await blockUser(userId)
            if (result.success) {
                toast.success('已屏蔽该用户')
                router.back()
            } else {
                toast.error(result.error || '屏蔽失败')
            }
        })
    }, [userId, router])

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
                </div>
            </div>
        )
    }

    if (!profileData) return null

    // ─── Private profile ────────
    if (profileData.isPrivate) {
        return (
            <div className="flex flex-col h-full bg-background">
                <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-lg">
                    <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-muted/20 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <span className="text-sm font-medium text-foreground">用户主页</span>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-8">
                    <div className="relative mb-6">
                        {profileData.user.avatarUrl ? (
                            <img
                                src={profileData.user.avatarUrl}
                                alt={profileData.user.nickname ?? '用户'}
                                className="w-24 h-24 rounded-full object-cover border-4 border-border"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center border-4 border-border">
                                <span className="text-3xl text-white">
                                    {profileData.user.nickname?.charAt(0) ?? '?'}
                                </span>
                            </div>
                        )}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-muted rounded-full p-1.5">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>

                    <h2 className="text-lg font-bold text-foreground mb-1">
                        {profileData.user.nickname ?? '未知用户'}
                    </h2>
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                        该用户未公开详细信息
                    </p>
                    <div className="mt-2 px-3 py-1 rounded-full bg-muted/30 border border-border">
                        <span className="text-xs text-muted-foreground">🔒 私密账号</span>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Public profile ────────
    const data = profileData

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto pb-24">
            {/* Top bar */}
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-background/80 backdrop-blur-lg">
                <div className="flex items-center gap-2">
                    <button onClick={() => router.back()} className="p-1 rounded-full hover:bg-muted/20 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </button>
                    <span className="text-sm font-medium text-foreground">
                        {data.user.nickname ?? '用户主页'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Follow button */}
                    {!data.isSelf && !data.isFollowing && (
                        <button
                            onClick={handleFollow}
                            disabled={isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            关注
                        </button>
                    )}
                    {!data.isSelf && data.isFollowing && (
                        <span className="px-3 py-1.5 rounded-full bg-muted/30 text-muted-foreground text-sm border border-border">
                            已关注
                        </span>
                    )}

                    {/* More menu */}
                    {!data.isSelf && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="p-2 rounded-full hover:bg-muted/20 transition-colors">
                                    <MoreHorizontal className="w-5 h-5 text-foreground" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card border-border">
                                <DropdownMenuItem
                                    onClick={handleBlock}
                                    className="text-red-400 focus:text-red-400 cursor-pointer"
                                >
                                    <ShieldBan className="w-4 h-4 mr-2" />
                                    屏蔽用户
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            <ProfileHeader
                user={data.user}
                isSelf={data.isSelf}
                likeCount={likeCount}
                isLikedByMe={isLiked}
                onToggleLike={handleToggleLike}
                followingCount={data.stats.following}
                followersCount={data.stats.followers}
            />

            <StatsGrid stats={data.stats} />

            <RunHistoryList userId={userId} />
        </div>
    )
}

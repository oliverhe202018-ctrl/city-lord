'use client'

import React, { useState, useCallback, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Edit2, Lock, User, Heart } from 'lucide-react'
import { toggleProfilePrivacy } from '@/app/actions/profile'
import { toast } from 'sonner'
import type { UserProfileBasic } from '@/app/actions/profile'

interface ProfileHeaderProps {
    user: UserProfileBasic
    isSelf: boolean
    isProfilePublic?: boolean
    likeCount?: number
    isLikedByMe?: boolean
    onToggleLike?: () => void
    // Following/Follower counts
    followingCount?: number
    followersCount?: number
}

export function ProfileHeader({
    user,
    isSelf,
    isProfilePublic = true,
    likeCount = 0,
    isLikedByMe = false,
    onToggleLike,
    followingCount = 0,
    followersCount = 0,
}: ProfileHeaderProps) {
    const [privacyOn, setPrivacyOn] = useState(isProfilePublic)
    const [isPending, startTransition] = useTransition()

    const handlePrivacyToggle = useCallback(
        (checked: boolean) => {
            setPrivacyOn(checked)
            startTransition(async () => {
                const result = await toggleProfilePrivacy(checked)
                if (result.success) {
                    toast.success(checked ? '资料已公开' : '资料已设为私密')
                } else {
                    setPrivacyOn(!checked)
                    toast.error(result.error || '操作失败')
                }
            })
        },
        []
    )

    return (
        <div className="relative">
            {/* Background Image */}
            <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-cyan-900">
                {user.backgroundUrl ? (
                    <Image
                        src={user.backgroundUrl}
                        alt="背景图"
                        fill
                        className="object-cover"
                        priority
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-purple-900/60 to-cyan-900/80" />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

                {/* Edit button (self) or Like button (others) */}
                {isSelf ? (
                    <Link
                        href="/profile/backgrounds"
                        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5 text-xs text-white/90 hover:bg-black/60 transition-colors border border-white/10"
                    >
                        <Edit2 className="w-3 h-3" />
                        编辑
                    </Link>
                ) : (
                    <button
                        onClick={onToggleLike}
                        className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5 text-sm text-white/90 hover:bg-black/60 transition-colors border border-white/10"
                    >
                        <Heart
                            className={`w-4 h-4 transition-colors ${isLikedByMe ? 'fill-red-500 text-red-500' : 'text-white/80'
                                }`}
                        />
                        <span>{likeCount}</span>
                    </button>
                )}
            </div>

            {/* User Info Overlay */}
            <div className="relative -mt-16 px-4 pb-4">
                <div className="flex items-end gap-4">
                    {/* Avatar */}
                    <Avatar className="h-20 w-20 border-4 border-background shadow-xl">
                        <AvatarImage src={user.avatarUrl ?? ''} alt={user.nickname ?? '用户'} />
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-purple-600 text-white text-2xl">
                            {user.nickname?.charAt(0) ?? <User className="w-8 h-8" />}
                        </AvatarFallback>
                    </Avatar>

                    {/* Name & Level */}
                    <div className="mb-1 flex-1">
                        <h1 className="text-xl font-bold text-foreground truncate">
                            {user.nickname ?? '未命名跑者'}
                        </h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 font-medium border border-cyan-500/20">
                                LVL {user.level ?? 1}
                            </span>
                            {user.badges?.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    🏅 {user.badges.length} 勋章
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Following/Followers + Privacy Toggle (self only) */}
                <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <p className="text-lg font-bold text-foreground">{followingCount}</p>
                            <p className="text-[10px] text-muted-foreground">关注</p>
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-bold text-foreground">{followersCount}</p>
                            <p className="text-[10px] text-muted-foreground">粉丝</p>
                        </div>
                    </div>

                    {isSelf && (
                        <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                                {privacyOn ? '公开' : '私密'}
                            </span>
                            <Switch
                                checked={privacyOn}
                                onCheckedChange={handlePrivacyToggle}
                                disabled={isPending}
                                className="data-[state=checked]:bg-cyan-500"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

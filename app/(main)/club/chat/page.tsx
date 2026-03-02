'use client'

import { useEffect, useState } from 'react'
import { ClubChatView } from '@/components/citylord/club/chat/ClubChatView'
import { createClient } from '@/lib/supabase/client'
import { getUserClub } from '@/app/actions/club'
import { Loader2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function ClubChatPage() {
    const router = useRouter()
    const [state, setState] = useState<{
        loading: boolean
        clubId: string | null
        userId: string | null
        error: string | null
    }>({ loading: true, clubId: null, userId: null, error: null })

    useEffect(() => {
        let cancelled = false

        async function init() {
            try {
                // Get current user
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    if (!cancelled) setState({ loading: false, clubId: null, userId: null, error: '请先登录' })
                    return
                }

                // Get user's club
                const club = await getUserClub()
                if (!club) {
                    if (!cancelled) setState({ loading: false, clubId: null, userId: user.id, error: 'NO_CLUB' })
                    return
                }

                if (!cancelled) {
                    setState({ loading: false, clubId: club.id, userId: user.id, error: null })
                }
            } catch {
                if (!cancelled) setState({ loading: false, clubId: null, userId: null, error: '加载失败' })
            }
        }

        init()
        return () => { cancelled = true }
    }, [])

    // Loading
    if (state.loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-black">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
        )
    }

    // No club
    if (state.error === 'NO_CLUB') {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black px-6">
                <Users className="h-12 w-12 text-white/20" />
                <h2 className="text-lg font-semibold text-white">尚未加入俱乐部</h2>
                <p className="text-sm text-white/50 text-center">加入一个俱乐部后即可使用频道交流功能</p>
                <Button
                    onClick={() => router.push('/lord-center')}
                    className="mt-2 bg-yellow-500 text-black hover:bg-yellow-400"
                >
                    探索俱乐部
                </Button>
            </div>
        )
    }

    // Error
    if (state.error || !state.clubId || !state.userId) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black px-6">
                <p className="text-sm text-red-400">{state.error || '未知错误'}</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.back()}
                    className="border-white/10 text-white/60"
                >
                    返回
                </Button>
            </div>
        )
    }

    return (
        <div className="h-screen overflow-hidden bg-black">
            <ClubChatView clubId={state.clubId} currentUserId={state.userId} />
        </div>
    )
}

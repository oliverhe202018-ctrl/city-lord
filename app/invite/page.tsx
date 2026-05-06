'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { acceptInvite } from '@/app/actions/user-invitations'
import { createClient } from '@/lib/supabase/client'

function InvitePageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const ref = searchParams.get('ref')

    const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error' | 'not-logged-in'>('loading')
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!ref) {
            setStatus('error')
            setErrorMessage('邀请链接无效')
            return
        }

        async function process() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                // Store ref in sessionStorage so it can be claimed after login/register
                sessionStorage.setItem('pendingInviteRef', ref!)
                setStatus('not-logged-in')
                return
            }

            const inviteLink = `/invite?ref=${ref}`
            const result = await acceptInvite(inviteLink)

            if (result.ok) {
                setStatus(result.data.alreadyAccepted ? 'already' : 'success')
            } else {
                setStatus('error')
                setErrorMessage(result.error?.message || '未知错误')
            }
        }

        process()
    }, [ref])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
            <div className="w-full max-w-sm text-center space-y-6">
                {/* Logo / Icon */}
                <div className="text-6xl mb-2">🏙️</div>
                <h1 className="text-2xl font-bold text-white">城市领主</h1>

                {status === 'loading' && (
                    <div className="space-y-3">
                        <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-white/60 text-sm">正在处理邀请…</p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-6 space-y-3">
                        <div className="text-4xl">🎉</div>
                        <h2 className="text-xl font-bold text-green-400">邀请接受成功！</h2>
                        <p className="text-white/70 text-sm">你和邀请人各获得了 <span className="text-yellow-400 font-bold">10 枚金币</span>！</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all active:scale-95"
                        >
                            开始游戏 →
                        </button>
                    </div>
                )}

                {status === 'already' && (
                    <div className="rounded-2xl bg-blue-500/10 border border-blue-500/30 p-6 space-y-3">
                        <div className="text-4xl">✅</div>
                        <h2 className="text-xl font-bold text-blue-300">邀请已被领取</h2>
                        <p className="text-white/60 text-sm">该邀请链接已经被处理过了。</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 w-full py-3 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all"
                        >
                            前往首页
                        </button>
                    </div>
                )}

                {status === 'not-logged-in' && (
                    <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-6 space-y-3">
                        <div className="text-4xl">🔑</div>
                        <h2 className="text-xl font-bold text-amber-300">请先登录</h2>
                        <p className="text-white/60 text-sm">注册或登录后，邀请奖励将自动发放。</p>
                        <button
                            onClick={() => router.push('/auth/login')}
                            className="mt-4 w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all active:scale-95"
                        >
                            登录 / 注册
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-6 space-y-3">
                        <div className="text-4xl">❌</div>
                        <h2 className="text-xl font-bold text-red-400">邀请处理失败</h2>
                        <p className="text-white/60 text-sm">{errorMessage}</p>
                        <button
                            onClick={() => router.push('/')}
                            className="mt-4 w-full py-3 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all"
                        >
                            返回首页
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function InvitePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
                <div className="w-10 h-10 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <InvitePageContent />
        </Suspense>
    )
}

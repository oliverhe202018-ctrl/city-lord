'use client'

import {
    createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'
import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChangelogNewVersionSheet } from './ChangelogNewVersionSheet'
import {
    getUnreadVersions, markVersionsAsRead, type UnreadVersion,
} from '@/app/actions/changelog/unread-actions'

// ── Constants ──
const DISMISS_KEY = 'cl_changelog_dismissed'

function isDismissedToday(): boolean {
    try {
        const v = localStorage.getItem(DISMISS_KEY)
        if (!v) return false
        return new Date(v).toDateString() === new Date().toDateString()
    } catch { return false }
}

function setDismissedToday(): void {
    try { localStorage.setItem(DISMISS_KEY, new Date().toISOString()) } catch {}
}

// ── Context ──
interface ChangelogNotificationContextValue {
    unreadCount: number
    refreshUnread: () => void
}

const ChangelogNotificationContext =
    createContext<ChangelogNotificationContextValue>({ unreadCount: 0, refreshUnread: () => {} })

export function useChangelogNotification() {
    return useContext(ChangelogNotificationContext)
}

// ── Provider ──
export function ChangelogNotificationProvider({ children }: { children: ReactNode }) {
    const supabase = createClient()

    const [unreadVersions, setUnreadVersions] = useState<UnreadVersion[]>([])
    const [showSheet, setShowSheet]           = useState(false)
    const [userId, setUserId]                 = useState<string | null>(null)
    const shownRef = useRef(false) // 防止同一个 session 多次弹窗

    // ── 1. 监听 Auth 状态 ──
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id ?? null)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
            setUserId(session?.user?.id ?? null)
            if (!session?.user) {
                setUnreadVersions([])
                setShowSheet(false)
                shownRef.current = false
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // ── 2. 用户确认后拉取未读版本 ──
    const fetchUnread = useCallback(async () => {
        const { data } = await getUnreadVersions()
        return data ?? []
    }, [])

    useEffect(() => {
        if (!userId || shownRef.current) return

        const timer = setTimeout(async () => {
            const versions = await fetchUnread()
            setUnreadVersions(versions)
            if (versions.length > 0 && !isDismissedToday()) {
                setShowSheet(true)
                shownRef.current = true
            }
        }, 1500) // 延迟，避免打断登录动画

        return () => clearTimeout(timer)
    }, [userId, fetchUnread])

    // ── 3. Realtime：监听管理员发布新版本 ──
    useEffect(() => {
        const channel = supabase
            .channel('changelog-realtime-updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'changelog_versions' },
                (payload: any) => {
                    const newRow = payload.new
                    const oldRow = payload.old
                    // 检测 published_at 从 null 变为非 null
                    if (newRow.published_at && !oldRow.published_at) {
                        toast.info(`🎉 City Lord v${newRow.version} 新版本发布！`, {
                            duration: 8000,
                            action: {
                                label: '查看更新',
                                onClick: () => {
                                    window.location.href = `/changelog/${newRow.version}`
                                },
                            },
                        })
                        // 刷新未读计数
                        fetchUnread().then(setUnreadVersions)
                    }
                }
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [fetchUnread])

    // ── Sheet 操作 ──
    const handleDismiss = useCallback(() => {
        setShowSheet(false)
        setDismissedToday()
    }, [])

    const handleReadAll = useCallback(() => {
        const ids = unreadVersions.map(v => v.id)
        markVersionsAsRead(ids).then(() => {
            setUnreadVersions([])
            setShowSheet(false)
        })
    }, [unreadVersions])

    return (
        <ChangelogNotificationContext.Provider
            value={{
                unreadCount:  unreadVersions.length,
                refreshUnread: () => fetchUnread().then(setUnreadVersions),
            }}
        >
            {children}
            {showSheet && (
                <ChangelogNewVersionSheet
                    versions={unreadVersions}
                    onDismiss={handleDismiss}
                    onReadAll={handleReadAll}
                />
            )}
        </ChangelogNotificationContext.Provider>
    )
}

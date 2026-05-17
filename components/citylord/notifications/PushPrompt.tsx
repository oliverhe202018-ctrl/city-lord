"use client"

import React, { useState, useEffect } from "react"
import { BellRing, X } from "lucide-react"

export function PushPrompt() {
    const [isPushEnabled, setIsPushEnabled] = useState(true) // Default true to prevent flicker
    const [isVisible, setIsVisible] = useState(true)

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                reg.pushManager.getSubscription().then(sub => {
                    setIsPushEnabled(!!sub)
                }).catch(console.error)
            }).catch(console.error)
        }
    }, [])

    const subscribeToPush = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            alert('当前浏览器不支持推送通知')
            return
        }
        try {
            const permission = await Notification.requestPermission()
            if (permission !== 'granted') {
                alert('推送权限被拒绝')
                return
            }
            const reg = await navigator.serviceWorker.ready
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.error('Missing VAPID public key')
                return
            }
            const padding = '='.repeat((4 - vapidKey.length % 4) % 4)
            const base64 = (vapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/')
            const rawData = window.atob(base64)
            const outputArray = new Uint8Array(rawData.length)
            for (let i = 0; i < rawData.length; ++i) {
                outputArray[i] = rawData.charCodeAt(i)
            }

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: outputArray
            })

            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub)
            })

            if (res.ok) {
                setIsPushEnabled(true)
            }
        } catch (error) {
            console.error('Failed to subscribe:', error)
        }
    }

    if (isPushEnabled || !isVisible) return null

    return (
        <div className="mx-4 mb-4 rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 flex flex-row items-center gap-3">
            <div className="shrink-0 rounded-lg bg-orange-500/20 p-2 text-orange-400">
                <BellRing className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-orange-400 mb-0.5">不要错过精彩活动</h4>
                <p className="text-xs text-orange-200/70">开启通知提醒，活动开始前及时通知您。</p>
            </div>
            <div className="flex shrink-0 items-center space-x-2">
                <button
                    onClick={subscribeToPush}
                    className="rounded-lg bg-orange-500 hover:bg-orange-600 transition-colors px-3 py-1.5 text-xs font-medium text-white shadow-sm"
                >
                    开启
                </button>
                <button
                    onClick={() => setIsVisible(false)}
                    className="p-1.5 text-orange-400/50 hover:text-orange-400 transition-colors rounded-lg hover:bg-orange-500/20"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

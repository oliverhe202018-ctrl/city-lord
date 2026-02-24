"use client"

/**
 * EarlyGeolocationPreloader
 * 
 * 在 App 启动时立即静默获取定位，将结果写入 localStorage。
 * 挂载在 layout.tsx 中，确保比业务组件更早开始定位流程。
 * 
 * 关键策略：
 * - 只在权限已授权时才直接获取定位
 * - 首次未授权时不弹权限弹窗，留给正常业务流程处理
 * - Web 端降级到 navigator.geolocation
 * - 全程静默，任何异常不影响主流程
 * - 写入时带时间戳，避免覆盖更新的定位数据
 */

import { useEffect, useRef } from 'react'
import { App } from '@capacitor/app'
import {
    isNativePlatform,
    safeCheckGeolocationPermission,
    safeGetCurrentPosition,
} from '@/lib/capacitor/safe-plugins'
import gcoord from 'gcoord'

const STORAGE_KEY = 'last_known_location'

/**
 * 写入 localStorage，仅当新数据比现有缓存更新时才覆盖
 */
function writeLocationToCache(lat: number, lng: number, accuracy: number) {
    try {
        const existing = localStorage.getItem(STORAGE_KEY)
        if (existing) {
            try {
                const parsed = JSON.parse(existing)
                // 预取器是辅助角色，不应覆盖主 hook (useSafeGeolocation) 写入的更高精度数据
                // accuracy 值越小越精确：如果缓存精度 ≤ 新数据精度，跳过写入
                if (typeof parsed.accuracy === 'number' && parsed.accuracy <= accuracy) {
                    console.debug(`[EarlyGeolocationPreloader] Skipped write: cache accuracy ${parsed.accuracy}m ≤ new ${accuracy}m`)
                    return
                }
            } catch { /* JSON parse failed, overwrite */ }
        }

        // 转换 WGS84 → GCJ02（与 useSafeGeolocation 一致）
        let finalLat = lat
        let finalLng = lng
        try {
            const result = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.GCJ02)
            finalLng = result[0]
            finalLat = result[1]
        } catch (e) {
            console.warn('[EarlyGeolocationPreloader] Coord transform failed, using raw WGS84', e)
        }

        const data = {
            lat: finalLat,
            lng: finalLng,
            accuracy,
            source: 'cache',
            coordSystem: 'gcj02',
            timestamp: Date.now(),
            fetchedAt: Date.now(),
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        console.debug('[EarlyGeolocationPreloader] Location cached:', finalLat.toFixed(4), finalLng.toFixed(4))
    } catch (e) {
        // localStorage 满了或不可用，静默忽略
        console.warn('[EarlyGeolocationPreloader] Cache write failed', e)
    }
}

async function fetchNativeLocation() {
    // 只检查权限，不请求权限（避免在 loading 屏弹出系统权限对话框）
    const permission = await safeCheckGeolocationPermission()
    if (permission !== 'granted') {
        console.debug('[EarlyGeolocationPreloader] Permission not granted, skipping native fetch')
        return
    }

    const position = await safeGetCurrentPosition({
        enableHighAccuracy: false,  // 先拿快速粗定位
        timeout: 3000,
        maximumAge: 60000,          // 允许 60s 内的缓存
    })

    if (position) {
        writeLocationToCache(position.lat, position.lng, position.accuracy)
    }

    // 再尝试高精度定位
    try {
        const precisePos = await safeGetCurrentPosition({
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 5000,
        })
        if (precisePos) {
            writeLocationToCache(precisePos.lat, precisePos.lng, precisePos.accuracy)
        }
    } catch {
        // 高精度超时也没关系，粗定位已经缓存了
    }
}

/**
 * Web 端获取定位（浏览器标准 API）
 */
function fetchWebLocation() {
    if (!navigator?.geolocation) {
        console.debug('[EarlyGeolocationPreloader] Web geolocation not available')
        return
    }

    // 快速粗定位
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            writeLocationToCache(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        },
        () => {
            // 权限被拒或者其他错误，静默忽略
            console.debug('[EarlyGeolocationPreloader] Web geolocation failed (coarse)')
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
    )

    // 高精度定位
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            writeLocationToCache(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy)
        },
        () => {
            console.debug('[EarlyGeolocationPreloader] Web geolocation failed (precise)')
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
    )
}

export function EarlyGeolocationPreloader() {
    const lastRefreshTime = useRef<number>(0)

    useEffect(() => {
        let isMounted = true
        let listenerHandle: any = null

        // 立即启动定位流程
        const prefetch = async () => {
            try {
                if (await isNativePlatform()) {
                    await fetchNativeLocation()

                    // Register background/foreground listener
                    App.addListener('appStateChange', async ({ isActive }) => {
                        if (isActive) {
                            const now = Date.now()
                            // 60s cooldown protection
                            if (now - lastRefreshTime.current < 60000) {
                                console.debug('[EarlyGeolocationPreloader] App resumed, skipped geolocation refresh (cooldown)')
                                return
                            }
                            console.debug('[EarlyGeolocationPreloader] App resumed, triggering geolocation refresh')
                            lastRefreshTime.current = now
                            // fetchNativeLocation internally uses writeLocationToCache which guards the accuracy
                            await fetchNativeLocation()
                        }
                    }).then(handle => {
                        if (isMounted) {
                            listenerHandle = handle
                        } else {
                            handle.remove()
                        }
                    })

                } else {
                    fetchWebLocation()
                }
            } catch (e) {
                // 全局兜底，确保任何异常都不会 crash 主流程
                console.warn('[EarlyGeolocationPreloader] Prefetch failed silently:', e)
            }
        }

        prefetch()

        return () => {
            isMounted = false
            if (listenerHandle) {
                listenerHandle.remove()
            }
        }
    }, [])

    // 纯逻辑组件，不渲染任何 UI
    return null
}

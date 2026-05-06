'use client'

import { createContext, useCallback, useContext, useRef } from 'react'
import type { ReactNode } from 'react'

type BackHandler = () => void

interface BackNavigationContextValue {
    registerHandler:   (id: string, handler: BackHandler) => void
    unregisterHandler: (id: string) => void
    getActiveHandler:  () => BackHandler | null
}

const BackNavigationContext = createContext<BackNavigationContextValue | null>(null)

export function BackNavigationProvider({ children }: { children: ReactNode }) {
    // Ref 存储：handler 变化不触发 re-render
    const handlerMapRef   = useRef<Map<string, BackHandler>>(new Map())
    const handlerOrderRef = useRef<string[]>([])

    const registerHandler = useCallback((id: string, handler: BackHandler) => {
        handlerMapRef.current.set(id, handler)
        // 移除旧位置，追加到末尾（末尾 = 最高优先级）
        handlerOrderRef.current = [
            ...handlerOrderRef.current.filter(h => h !== id),
            id,
        ]
    }, [])

    const unregisterHandler = useCallback((id: string) => {
        handlerMapRef.current.delete(id)
        handlerOrderRef.current = handlerOrderRef.current.filter(h => h !== id)
    }, [])

    const getActiveHandler = useCallback((): BackHandler | null => {
        const order = handlerOrderRef.current
        if (order.length === 0) return null
        return handlerMapRef.current.get(order[order.length - 1]) ?? null
    }, [])

    return (
        <BackNavigationContext.Provider
            value={{ registerHandler, unregisterHandler, getActiveHandler }}
        >
            {children}
        </BackNavigationContext.Provider>
    )
}

export function useBackNavigationContext() {
    const ctx = useContext(BackNavigationContext)
    if (!ctx) {
        throw new Error('useBackNavigationContext must be used within BackNavigationProvider')
    }
    return ctx
}

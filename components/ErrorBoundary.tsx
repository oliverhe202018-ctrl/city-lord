"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/useGameStore'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-4">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <h2 className="mb-2 text-xl font-bold text-white">出现错误</h2>
            <p className="mb-4 text-sm text-white/60">
              页面加载时遇到严重问题
            </p>
            <div className="mb-4 text-left text-xs bg-black/30 p-3 rounded overflow-hidden">
                <p className="text-red-400 font-bold mb-1 break-all">
                  {this.state.error?.message}
                </p>
                {this.state.error?.stack && (
                  <p className="text-red-300/50 font-mono break-all whitespace-pre-wrap">
                    {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                  </p>
                )}
            </div>
            <RefreshButton />
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function RefreshButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        try {
            const state = useGameStore.getState();
            if (state.resetRunState) state.resetRunState();
            if (state.resetUser) state.resetUser();
        } catch (e) {
            console.error('Reset failed', e);
        }
        router.replace('/');
      }}
      className="rounded-xl bg-red-500/20 px-6 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/30 w-full"
    >
      重置游戏状态并返回大厅
    </button>
  )
}

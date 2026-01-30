"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'

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
              页面加载时遇到问题
            </p>
            <p className="mb-4 text-xs text-red-400/80 break-all">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-red-500/20 px-6 py-2 text-sm font-medium text-red-400 transition-all hover:bg-red-500/30"
            >
              重新加载
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

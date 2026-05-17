'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { 
  children: ReactNode; 
}

interface State { 
  hasError: boolean; 
  error: Error | null; 
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { 
    hasError: false, 
    error: null 
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // TODO: 后期可以接入 Sentry 等上报工具
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-[#0a0f1e] rounded-xl border border-gray-800 m-4 shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
          <h2 className="text-white text-lg font-bold mb-2">系统开小差了</h2>
          <p className="text-gray-400 text-sm text-center mb-6 max-w-[280px]">
            局部界面加载失败，但不影响您的核心游戏数据。
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-8 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-medium transition-all transform active:scale-95 shadow-lg shadow-purple-500/20"
          >
            尝试恢复
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

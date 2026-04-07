"use client";

import React, { useEffect } from "react";
import { ThemeProvider } from '@/components/citylord/theme/theme-provider';
import { CityProvider } from '@/contexts/CityContext';
import { RegionProvider } from '@/contexts/RegionContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { Toaster } from "@/components/ui/sonner";
import { AuthSync } from "@/components/auth/AuthSync";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Providers } from '@/components/Providers';
import { PendingRunUploadRetry } from '@/components/running/PendingRunUploadRetry';
import { GlobalLocationProvider } from '@/components/GlobalLocationProvider';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { BackNavigationProvider, useBackNavigationContext } from '@/contexts/BackNavigationContext';
import { ChangelogNotificationProvider } from '@/components/changelog/ChangelogNotificationProvider';
import { useRouter } from 'next/navigation';
import { isNativePlatform, safeGetPlatform, safeStatusBarSetBackgroundColor, safeStatusBarSetOverlaysWebView, safeStatusBarSetStyle } from "@/lib/capacitor/safe-plugins";
import { useImmersiveMode } from "@/hooks/useImmersiveMode";

// Client Component Wrapper for Status Bar
function StatusBarConfig() {
  // Activate Immersive Mode Locks
  useImmersiveMode();

  useEffect(() => {
    const applyStatusBar = async () => {
      if (await isNativePlatform()) {
        safeStatusBarSetStyle('dark');
        const platform = await safeGetPlatform();
        if (platform === 'android') {
          // 关键修复：关闭 Overlay，让 WebView 位于状态栏下方
          safeStatusBarSetOverlaysWebView(false);
          safeStatusBarSetBackgroundColor('#000000');

          // RISK-01: 读取 Android StatusBar 高度并注入 CSS 变量
          try {
            const { StatusBar } = await import('@capacitor/status-bar');
            const info = await StatusBar.getInfo();
            // Android StatusBar 不直接暴露高度，但 overlaysWebView: false 意味着
            // WebView 已经在状态栏下方，所以 safe-area-inset-top 为 0
            // 注入一个辅助变量供完全自定义布局使用
            document.documentElement.style.setProperty(
              '--android-status-bar-height',
              '0px' // overlaysWebView: false 时 WebView 不被状态栏遮挡
            );
          } catch {
            document.documentElement.style.setProperty('--android-status-bar-height', '0px');
          }
        }
      }
    };
    applyStatusBar();
  }, []);

  return null;
}

/**
 * 全局唯一的 Android 物理返回键监听器。
 * 必须位于 BackNavigationProvider 内部。
 * 左侧边缘滑动在 Android 手势导航模式下同样触发 backButton 事件，由此统一处理。
 */
function GlobalBackButtonHandler() {
    const router = useRouter()
    const { getActiveHandler } = useBackNavigationContext()

    useEffect(() => {
        // 仅在原生平台注册（Web 端无物理返回键）
        if (!Capacitor.isNativePlatform()) return

        const listenerPromise = CapacitorApp.addListener('backButton', () => {
            const handler = getActiveHandler()

            if (handler) {
                // 有页面级 handler（来自 usePageBackNavigation）：执行页面自定义逻辑
                handler()
            } else {
                // 全局兜底（38 个未覆盖页面走此路径）
                if (typeof window !== 'undefined' && window.history.state?.idx > 0) {
                    // 有历史：正常回退
                    router.back()
                } else {
                    // 无历史：按当前路径决策
                    const currentPath = window.location.pathname
                    if (currentPath === '/') {
                        // 在根路径：退出 App（符合 Android 用户预期）
                        CapacitorApp.exitApp()
                    } else {
                        // 其余路径无历史（异常情况）：回首页
                        router.replace('/')
                    }
                }
            }
        })

        return () => {
            // 组件卸载时移除监听（正常情况下 layout 不卸载，此处为防御性清理）
            listenerPromise.then(l => l.remove())
        }
    }, [])
    // 空依赖数组：仅挂载时注册一次
    // getActiveHandler 读 ref（始终是当前值，无需捕获），router 在 App Router 中稳定

    return null
}

function RouterEventBridge() {
  const router = useRouter()

  useEffect(() => {
    const handleRefresh = () => {
      router.refresh()
    }

    const handleNavigate = (event: Event) => {
      const e = event as CustomEvent<{ to?: string; replace?: boolean }>
      const to = e.detail?.to
      if (!to) return
      if (e.detail?.replace) {
        router.replace(to)
      } else {
        router.push(to)
      }
    }

    window.addEventListener('citylord:router-refresh', handleRefresh)
    window.addEventListener('citylord:navigate', handleNavigate as EventListener)
    return () => {
      window.removeEventListener('citylord:router-refresh', handleRefresh)
      window.removeEventListener('citylord:navigate', handleNavigate as EventListener)
    }
  }, [router])

  return null
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <BackNavigationProvider>
      <StatusBarConfig />
      <GlobalBackButtonHandler />
      <RouterEventBridge />
      {/* 已彻底切除高危启动项 PushNotificationBootstrapper */}

      <GlobalLocationProvider>
        <GlobalErrorBoundary>
          <Providers>
            <ThemeProvider>
              <RegionProvider>
                <CityProvider>
                  <NetworkStatus />
                  <AuthSync />
                  <ChangelogNotificationProvider>
                    <PendingRunUploadRetry />
                    {children}
                    <Toaster />
                  </ChangelogNotificationProvider>
                </CityProvider>
              </RegionProvider>
            </ThemeProvider>
          </Providers>
        </GlobalErrorBoundary>
      </GlobalLocationProvider>
    </BackNavigationProvider>
  );
}

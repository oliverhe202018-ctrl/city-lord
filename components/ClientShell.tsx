"use client";

import React, { useEffect, useRef } from "react";
import { ThemeProvider } from '@/components/citylord/theme/theme-provider';
import { CityProvider } from '@/contexts/CityContext';
import { RegionProvider } from '@/contexts/RegionContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { Toaster } from "@/components/ui/sonner";
import { AuthSync } from "@/components/auth/AuthSync";
import { NetworkStatus } from "@/components/NetworkStatus";
import { Providers } from '@/components/Providers';
import { PendingRunUploadRetry } from '@/components/running/PendingRunUploadRetry';
import { RewardModal } from '@/components/running/RewardModal';
import { GlobalLocationProvider } from '@/components/GlobalLocationProvider';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { BackNavigationProvider, useBackNavigationContext } from '@/contexts/BackNavigationContext';
import { ChangelogNotificationProvider } from '@/components/changelog/ChangelogNotificationProvider';
import { useRouter, usePathname } from 'next/navigation';
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
          // 开启 Overlay，让 WebView 延伸到状态栏下方（沉浸式）
          // 配合 CSS padding-top: var(--safe-top) 防止内容被遮挡
          safeStatusBarSetOverlaysWebView(true);
          safeStatusBarSetBackgroundColor('#000000');

          // 读取 Android StatusBar 高度并注入 CSS 变量
          // Android WebView 不支持 env(safe-area-inset-top)，需手动注入
          try {
            const { StatusBar } = await import('@capacitor/status-bar');
            const info = await StatusBar.getInfo();
            const statusBarHeight = (info as any).height ?? 0;
            document.documentElement.style.setProperty(
              '--android-status-bar-height',
              `${statusBarHeight}px`
            );
            // 同时覆盖 --safe-top，确保全局 safe-pt 等工具类生效
            document.documentElement.style.setProperty(
              '--safe-top',
              `${statusBarHeight}px`
            );
          } catch (err) {
            console.warn('[StatusBar] Failed to get info', err);
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
 * 全局唯一的 Android 物理返回键/侧滑手势监听器。
 * 必须位于 BackNavigationProvider 内部。
 * 左侧边缘滑动在 Android 手势导航模式下同样触发 backButton 事件，由此统一处理。
 */
function GlobalBackButtonHandler() {
    const router = useRouter()
    const pathname = usePathname()
    const { getActiveHandler } = useBackNavigationContext()
    const rootPaths = ['/', '/home']
    const pathnameRef = useRef(pathname)

    // 路由变化时同步 pathnameRef
    useEffect(() => {
        pathnameRef.current = pathname
    }, [pathname])

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return

        const listenerPromise = CapacitorApp.addListener('backButton', () => {
            const handler = getActiveHandler()

            if (handler) {
                handler()
            } else {
                const currentPath = pathnameRef.current || window.location.pathname
                if (rootPaths.includes(currentPath)) {
                    CapacitorApp.exitApp()
                } else {
                    router.back()
                }
            }
        })

        return () => {
            listenerPromise.then(l => l.remove())
        }
    }, [router, getActiveHandler])

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
                    <RewardModal />
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

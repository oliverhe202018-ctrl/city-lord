"use client";

import React, { useEffect, useRef } from "react";
import { ThemeProvider } from '@/components/citylord/theme/theme-provider';
import { CityProvider } from '@/contexts/CityContext';
import { RegionProvider } from '@/contexts/RegionContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import { AuthSync } from '@/components/auth/AuthSync';
import { NetworkStatus } from '@/components/NetworkStatus';
import { Providers } from '@/components/Providers';
import { GlobalLocationProvider } from '@/components/GlobalLocationProvider';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { BackNavigationProvider, useBackNavigationContext } from '@/contexts/BackNavigationContext';
import { ChangelogNotificationProvider } from '@/components/changelog/ChangelogNotificationProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeGetPlatform, safeStatusBarSetBackgroundColor, safeStatusBarSetOverlaysWebView, safeStatusBarSetStyle } from '@/lib/capacitor/safe-plugins';
import { useImmersiveMode } from '@/hooks/useImmersiveMode';

// Client Component Wrapper for Status Bar
function StatusBarConfig() {
  useImmersiveMode();

  useEffect(() => {
    const applySafeArea = async () => {
      if (!Capacitor.isNativePlatform()) return;

      safeStatusBarSetStyle('dark');
      const platform = await safeGetPlatform();
      if (platform === 'android') {
        safeStatusBarSetOverlaysWebView(true);
        safeStatusBarSetBackgroundColor('#000000');

        try {
          const { SafeArea } = await import('@capacitor-community/safe-area');
          const insets = await SafeArea.getSafeAreaInsets();
          const topInset = insets.insets?.top ?? 24;

          document.documentElement.style.setProperty('--safe-top', `${topInset}px`);
          document.documentElement.style.setProperty('--safe-bottom', `${insets.insets?.bottom ?? 0}px`);
          document.documentElement.style.setProperty('--safe-left', `${insets.insets?.left ?? 0}px`);
          document.documentElement.style.setProperty('--safe-right', `${insets.insets?.right ?? 0}px`);
          document.documentElement.style.setProperty('--android-status-bar-height', `${topInset}px`);
        } catch (err) {
          console.warn('[SafeArea] Failed to get insets, using fallback 24px', err);
          document.documentElement.style.setProperty('--safe-top', '24px');
          document.documentElement.style.setProperty('--android-status-bar-height', '24px');
        }
      }
    };
    applySafeArea();
  }, []);

  return null;
}

/**
 * 全局唯一的 Android 物理返回键/侧滑手势监听器。
 * 必须位于 BackNavigationProvider 内部。
 * 左侧边缘滑动在 Android 手势导航模式下同样触发 backButton 事件，由此统一处理。
 */
function GlobalBackButtonHandler() {
    const navigate = useNavigate()
    const pathname = useLocation().pathname
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
                    navigate(-1)
                }
            }
        })

        return () => {
            listenerPromise.then(l => l.remove())
        }
    }, [navigate, getActiveHandler])

    return null
}

function RouterEventBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleRefresh = () => {
      window.location.reload()
    }

    const handleNavigate = (event: Event) => {
      const e = event as CustomEvent<{ to?: string; replace?: boolean }>
      const to = e.detail?.to
      if (!to) return
      if (e.detail?.replace) {
        navigate(to, { replace: true })
      } else {
        navigate(to)
      }
    }

    window.addEventListener('citylord:router-refresh', handleRefresh)
    window.addEventListener('citylord:navigate', handleNavigate as EventListener)
    return () => {
      window.removeEventListener('citylord:router-refresh', handleRefresh)
      window.removeEventListener('citylord:navigate', handleNavigate as EventListener)
    }
  }, [navigate])

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

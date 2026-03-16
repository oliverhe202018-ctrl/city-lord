"use client";

import React from "react"
import type { Metadata, Viewport } from 'next'
// import { Geist, Geist_Mono } from 'next/font/google'

import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/citylord/theme/theme-provider'
import { CityProvider } from '@/contexts/CityContext'
import { RegionProvider } from '@/contexts/RegionContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Toaster } from "@/components/ui/sonner"
import { AuthSync } from "@/components/auth/AuthSync"
import { NetworkStatus } from "@/components/NetworkStatus"
import Script from 'next/script'
import { Providers } from '@/components/Providers'
import { PendingRunUploadRetry } from '@/components/running/PendingRunUploadRetry'
import { GlobalLocationProvider } from '@/components/GlobalLocationProvider'
// import { PushNotificationBootstrapper } from '@/components/PushNotificationBootstrapper' // 已去除 Firebase 依赖
import './globals.css'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { BackNavigationProvider, useBackNavigationContext } from '@/contexts/BackNavigationContext'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useEffect } from "react";
import { ChangelogNotificationProvider } from '@/components/changelog/ChangelogNotificationProvider'
import { useRouter } from 'next/navigation'
import { isNativePlatform, safeGetPlatform, safeStatusBarSetBackgroundColor, safeStatusBarSetOverlaysWebView, safeStatusBarSetStyle } from "@/lib/capacitor/safe-plugins";
import { useBackgroundLocation } from '@/hooks/useBackgroundLocation';
import { useImmersiveMode } from "@/hooks/useImmersiveMode";

const amapSecurityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || ''
const amapSecurityScript = `window._AMapSecurityConfig = { securityJsCode: ${JSON.stringify(amapSecurityCode)} }`

const viewport: Viewport = {

  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 禁止用户缩放，防止组件撑开屏幕
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content', // 确保软键盘弹出时调整视口高度
  // 针对 iOS 的特殊处理
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

const metadata: Metadata = {
  title: 'CityLord - 跑步领地争霸',
  description: '用跑步征服你的城市。一款将跑步与领地占领相结合的游戏化健身应用。',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}


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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      <body className={`font-sans antialiased h-full overflow-hidden overflow-x-hidden w-full relative pt-[env(safe-area-inset-top)]`}>
        <BackNavigationProvider>
          <StatusBarConfig />
          <GlobalBackButtonHandler />
          {/* 已彻底切除高危启动项 PushNotificationBootstrapper */}
          <Script id="amap-security" strategy="beforeInteractive">
            {amapSecurityScript}
          </Script>

          <GlobalLocationProvider>
            <ErrorBoundary>
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
            </ErrorBoundary>
          </GlobalLocationProvider>
          <Analytics />
          <SpeedInsights />
        </BackNavigationProvider>
      </body>
    </html>
  )
}

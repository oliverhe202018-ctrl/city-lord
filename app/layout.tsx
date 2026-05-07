import React from "react"
import type { Metadata, Viewport } from 'next'

import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ClientShell } from '@/components/ClientShell'
import './globals.css'

const amapSecurityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE || ''
const amapSecurityScript = `window._AMapSecurityConfig = { securityJsCode: ${JSON.stringify(amapSecurityCode)} }`

export const viewport: Viewport = {
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

export const metadata: Metadata = {
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      <body className={`font-sans antialiased h-full overflow-hidden overflow-x-hidden w-full relative bg-white text-slate-900 dark:bg-[#0f172a] dark:text-slate-200`}>
        <Script id="amap-security" strategy="beforeInteractive">
          {amapSecurityScript}
        </Script>

        <ClientShell>
          {children}
        </ClientShell>

        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

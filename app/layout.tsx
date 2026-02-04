import React from "react"
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
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
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 禁止用户缩放，防止组件撑开屏幕
  viewportFit: 'cover',
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
      <body className={`font-sans antialiased h-full overflow-hidden overflow-x-hidden w-full relative`}>
        <Script id="amap-security" strategy="beforeInteractive">
          {`
            window._AMapSecurityConfig = {
              securityJsCode: 'e827ba611fad4802c48dd900d01eb4bf',
            }
          `}
        </Script>
        <ErrorBoundary>
          <Providers>
            <ThemeProvider defaultTheme="cyberpunk">
              <RegionProvider>
                <CityProvider>
                  <NetworkStatus />
                  <AuthSync />
                  {children}
                  <Toaster />
                </CityProvider>
              </RegionProvider>
            </ThemeProvider>
          </Providers>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}

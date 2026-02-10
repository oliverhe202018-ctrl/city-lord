import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// 注意：Next.js 16+ 中 middleware 文件约定已废弃，建议使用 proxy.ts
// 但 proxy 功能目前仍在实验阶段，暂保留 middleware 以确保兼容性
export async function middleware(request: NextRequest) {
  // Special handling for auth callback - pass through without modification
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    console.log('[Middleware] Auth callback request, passing through')
    return NextResponse.next({ request })
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

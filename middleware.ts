import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
];

function setCorsHeaders(response: NextResponse, origin: string | null) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization,X-Idempotency-Key'
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');

  // ── OPTIONS preflight：直接拦截并返回 204 ──────────────────────────────────
  // 这解决了 API 路由可能没有实现 OPTIONS handler 导致的 404 Preflight 失败问题
  if (request.method === 'OPTIONS') {
    return setCorsHeaders(new NextResponse(null, { status: 204 }), origin);
  }

  // ── /api/* 路由：注入 CORS 头后直接透传，绕过原本的 Supabase session 逻辑 ─────
  // 注意：API 内部通常有自己的 Auth 逻辑或已在 Supabase client 处理
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next();
    return setCorsHeaders(response, origin);
  }

  // ── 其余页面路由：保留原有 session 逻辑 ─────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  // 特殊处理 auth callback
  if (request.nextUrl.pathname.startsWith('/auth/callback')) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 更新 Supabase 会话
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 强制匹配 /api/* 使其能走进中间件处理 CORS 和 OPTIONS
    '/api/:path*',
    // 排除静态资源
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

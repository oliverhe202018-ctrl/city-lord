import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

const ALLOWED_ORIGINS = [
  'capacitor://localhost',
  'http://localhost',
  'ionic://localhost',
  'https://cl1.6543666.xyz',
  ...(process.env.VERCEL_ENV !== 'production' ? ['http://localhost:3000', 'http://10.0.2.2:3000', 'http://localhost:5173', 'http://localhost:5174'] : []),
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

  // ── /api/* 路由：注入 CORS 头后直接透传，并解析 Supabase User 注入 Request Headers ─────
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-user-id');
    if (user) {
      requestHeaders.set('x-user-id', user.id);
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    });
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
  return await updateSession(request, requestHeaders);
}

export const config = {
  matcher: [
    // 强制匹配 /api/* 使其能走进中间件处理 CORS 和 OPTIONS
    '/api/:path*',
    // 排除静态资源
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

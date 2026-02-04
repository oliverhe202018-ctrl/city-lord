import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // 1. Basic Token Check (Lightweight)
  // Just check if the cookie exists. Do NOT call supabase.auth.getUser() here.
  // This avoids a database round-trip on every single request.
  const hasAuthCookie = request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Create client ONLY for cookie management (refreshing tokens)
  // We still need this to allow Supabase to refresh cookies if needed,
  // but we won't block on getUser() unless necessary for protection.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Protected Routes Logic
  // Only check auth status strictly if we are on a protected route.
  // This reduces latency for static assets and public pages.
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/city-lord') || 
                           request.nextUrl.pathname.startsWith('/profile')

  if (isProtectedRoute) {
    // Check user only when necessary
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

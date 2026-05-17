import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

// 解决 Node 18+ 环境下 Fetch 请求 Supabase IPv6 解析超时导致的 ECONNRESET 和 缓慢问题
if (typeof process !== "undefined" && process.release?.name === "node") {
  try {
    // 使用 eval("require") 完全绕过 Next.js/Webpack 静态打包分析，避免 "Module not found: Can't resolve 'dns'"
    const requireFunc = eval("require");
    const dns = requireFunc("dns");
    if (dns && dns.setDefaultResultOrder) {
      dns.setDefaultResultOrder("ipv4first");
    }
  } catch (e) {
    console.warn("Could not set DNS result order:", e);
  }
}

export const createClient = async (
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
) => {
  const resolvedCookieStore = cookieStore ?? (await cookies())

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return resolvedCookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              resolvedCookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

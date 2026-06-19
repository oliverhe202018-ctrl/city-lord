import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type Database } from '@/types/supabase'
import { capacitorStorage } from '@/lib/capacitor-storage'

let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null

export const createClient = () => {
  if (supabaseInstance) return supabaseInstance

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ Supabase Environment Variables Missing!', {
      url: supabaseUrl ? 'Set' : 'Missing',
      key: supabaseKey ? 'Set' : 'Missing'
    })
  }

  if (supabaseKey && !supabaseKey.startsWith('ey') && !supabaseKey.startsWith('sb_')) {
    console.warn('⚠️ Supabase Key format looks suspicious (expected JWT starting with "ey" or "sb_")', supabaseKey.substring(0, 5) + '...')
  }

  supabaseInstance = createSupabaseClient<Database>(
    supabaseUrl!,
    supabaseKey!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // [P0 Fix] 防止 hash 解析异常导致 Crash
        detectSessionInUrl: false,
        // [P0 Fix] 注入 Capacitor Storage 适配器，替代原生 localStorage
        storage: capacitorStorage,
        // [P0 Fix] 强制使用 PKCE 流程，提升安全性并防止 hash 解析异常
        flowType: 'pkce',
      },
    }
  )

  return supabaseInstance
}

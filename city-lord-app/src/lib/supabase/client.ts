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
        detectSessionInUrl: false,
        storage: capacitorStorage,
      },
    }
  )

  return supabaseInstance
}

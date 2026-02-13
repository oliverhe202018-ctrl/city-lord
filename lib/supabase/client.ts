import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ Supabase Environment Variables Missing!', {
      url: supabaseUrl ? 'Set' : 'Missing',
      key: supabaseKey ? 'Set' : 'Missing'
    })
    // Return a dummy client that warns on use, or let it fail gracefully
  }

  // Basic validation for JWT format (Supabase keys are usually JWTs starting with 'ey')
  if (supabaseKey && !supabaseKey.startsWith('ey') && !supabaseKey.startsWith('sb_')) {
    console.warn('⚠️ Supabase Key format looks suspicious (expected JWT starting with "ey" or "sb_")', supabaseKey.substring(0, 5) + '...')
  }

  return createBrowserClient<Database>(
    supabaseUrl!,
    supabaseKey!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    }
  )
}

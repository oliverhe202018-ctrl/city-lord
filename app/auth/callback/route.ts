import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Initialize User Missions
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        try {
          // 1. Check if initialized
          const { count } = await supabase
            .from('user_missions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)

          if (count === 0) {
            // 2. Fetch all missions
            const { data: missions } = await supabase
              .from('missions')
              .select('id')
            
            if (missions && missions.length > 0) {
              // 3. Insert initial records
              const initialMissions = missions.map((m: any) => ({
                user_id: user.id,
                mission_id: m.id,
                status: 'active', // Initial status
                progress: 0,
                updated_at: new Date().toISOString()
              }))

              await supabase
                .from('user_missions')
                .insert(initialMissions)
            }
          }
        } catch (e) {
          console.error('Mission initialization failed:', e)
        }
      }
      
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}

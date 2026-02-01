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
          // Call the initialization RPC function
          // This will set up missions and badges if they don't exist
          await supabase.rpc('init_user_game_data', { 
            target_user_id: user.id 
          })
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

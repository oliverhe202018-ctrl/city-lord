import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getReferrerProfile } from '@/app/actions/referral'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const referralCode = searchParams.get('referralCode')

    if (!referralCode) {
      return NextResponse.json({ error: 'referralCode required' }, { status: 400 })
    }

    const profile = await getReferrerProfile(referralCode)
    return NextResponse.json(profile)
  } catch (error: any) {
    console.error('getReferrerProfile error:', error)
    return NextResponse.json(null, { status: 200 })
  }
}

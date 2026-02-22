import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRunReport } from '@/app/actions/report'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') || 'daily') as 'daily' | 'weekly' | 'monthly'

    const report = await getRunReport(user.id, period)
    return NextResponse.json(report)
  } catch (error: any) {
    console.error('getRunReport error:', error)
    return NextResponse.json(null, { status: 200 })
  }
}

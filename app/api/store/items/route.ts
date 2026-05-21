import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStoreItems } from '@/app/actions/store-service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const items = await getStoreItems()
    return NextResponse.json({ success: true, items })
  } catch (error: any) {
    console.error('getStoreItems error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch store items' },
      { status: 500 }
    )
  }
}

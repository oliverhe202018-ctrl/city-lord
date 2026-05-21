import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { purchaseItem } from '@/app/actions/store-service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { itemId } = body || {}

    if (!itemId) {
      return NextResponse.json({ error: 'itemId required' }, { status: 400 })
    }

    const result = await purchaseItem(user.id, itemId)

    if (!result.success) {
      const status = result.errorCode === 'INSUFFICIENT_COINS' ? 402 : 400
      return NextResponse.json(result, { status })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('purchaseItem error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Purchase failed' },
      { status: 500 }
    )
  }
}

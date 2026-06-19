import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/v1/store/items
 * Fetch all active store items
 */
export async function GET(request: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const items = await prisma.store_items.findMany({
            where: { is_active: true },
            orderBy: { created_at: 'desc' }
        })

        return NextResponse.json({ success: true, items })
    } catch (e: any) {
        console.error('[GET /api/v1/store/items] Error:', e)
        return NextResponse.json(
            { success: false, error: 'Failed to fetch store items' },
            { status: 500 }
        )
    }
}

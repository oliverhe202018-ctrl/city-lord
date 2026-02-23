import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const clubs = await prisma.clubs.findMany({
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({ success: true, data: clubs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Failed to fetch clubs' }, { status: 500 })
  }
}

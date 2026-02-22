import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createBadgeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  icon_name: z.string().optional(),
  requirement_description: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const body = createBadgeSchema.parse(json)

    // Generate a unique code if not provided
    // Simple slugification: name-random
    const code = `${body.name.toLowerCase().replace(/\s+/g, '-')}-${Math.random().toString(36).substring(2, 7)}`

    const badge = await prisma.badges.create({
      data: {
        code,
        name: body.name,
        description: body.description,
        icon_name: body.icon_name,
        requirement_description: body.requirement_description,
        // Defaults
        category: 'general',
        tier: 'bronze',
      }
    })

    return NextResponse.json({ success: true, data: badge })
  } catch (error: any) {
    console.error("Create Badge Error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create badge" },
      { status: 500 }
    )
  }
}

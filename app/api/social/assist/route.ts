import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { friendId } = await req.json()

        if (!friendId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
        }

        // Give some experience or coins to the sender as a reward
        await prisma.profiles.update({
            where: { id: user.id },
            data: {
                coins: { increment: 5 }
            }
        })

        // In a full implementation, this could also update the friend's stamina
        // For now, we simulate a successful assist

        return NextResponse.json({ success: true, message: "Assisted successfully" })
    } catch (error) {
        console.error('Assist error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

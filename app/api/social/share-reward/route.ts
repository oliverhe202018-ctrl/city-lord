import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { type, targetId } = await req.json()

        // Arbitrary daily/weekly limits could be implemented here
        // For now, grant a fixed reward for sharing
        const REWARD_COINS = 10
        const REWARD_EXP = 5

        await prisma.profiles.update({
            where: { id: user.id },
            data: {
                coins: { increment: REWARD_COINS },
                current_exp: { increment: REWARD_EXP }
            }
        })

        return NextResponse.json({
            success: true,
            message: "Reward granted",
            rewards: { coins: REWARD_COINS, exp: REWARD_EXP }
        })
    } catch (error) {
        console.error('Share reward error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

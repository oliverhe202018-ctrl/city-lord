import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import {
    ClubChatError,
    DEFAULT_CHANNELS,
    type ClubChannel,
} from '@/lib/types/club-chat.types'

/**
 * GET /api/v1/club/chat/channels?clubId=xxx
 * Fetch club channels, auto-seed if empty
 */
export async function GET(request: NextRequest) {
    try {
        // Auth
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json(
                { success: false, error: ClubChatError.NOT_AUTHENTICATED, message: '请先登录' },
                { status: 401 }
            )
        }

        // Get clubId from query params
        const { searchParams } = new URL(request.url)
        const clubId = searchParams.get('clubId')

        if (!clubId) {
            return NextResponse.json(
                { success: false, error: ClubChatError.CLUB_NOT_FOUND, message: '无效的俱乐部ID' },
                { status: 400 }
            )
        }

        // Membership check
        const member = await prisma.club_members.findUnique({
            where: {
                club_id_user_id: { club_id: clubId, user_id: user.id },
            },
            select: { role: true, status: true },
        })

        if (!member || member.status !== 'active') {
            return NextResponse.json(
                { success: false, error: ClubChatError.CLUB_NOT_MEMBER, message: '你不是该俱乐部成员' },
                { status: 403 }
            )
        }

        // Try to query existing channels
        let channels: { id: string; club_id: string; key: string; name: string; sort_order: number }[]
        try {
            channels = await prisma.club_channels.findMany({
                where: { club_id: clubId },
                orderBy: { sort_order: 'asc' },
            })
        } catch (dbError: any) {
            console.error('[getClubChannels] DB query error for clubId:', clubId, dbError?.message || dbError)
            return NextResponse.json(
                { success: false, error: ClubChatError.INTERNAL_ERROR, message: `数据库查询失败: ${dbError?.message?.slice(0, 100) || '未知数据库错误'}` },
                { status: 500 }
            )
        }

        // Auto-seed if empty
        if (channels.length === 0) {
            try {
                await prisma.club_channels.createMany({
                    data: DEFAULT_CHANNELS.map((ch) => ({
                        club_id: clubId,
                        key: ch.key,
                        name: ch.name,
                        sort_order: ch.sort_order,
                    })),
                    skipDuplicates: true,
                })

                // Re-query after seed
                channels = await prisma.club_channels.findMany({
                    where: { club_id: clubId },
                    orderBy: { sort_order: 'asc' },
                })
            } catch (seedError: any) {
                console.error('[getClubChannels] Seed error for clubId:', clubId, seedError?.message || seedError)
                return NextResponse.json(
                    { success: false, error: ClubChatError.INTERNAL_ERROR, message: `频道初始化失败: ${seedError?.message?.slice(0, 100) || '未知错误'}` },
                    { status: 500 }
                )
            }
        }

        return NextResponse.json({
            success: true,
            data: channels.map((ch) => ({
                id: ch.id,
                clubId: ch.club_id,
                key: ch.key,
                name: ch.name,
                sortOrder: ch.sort_order,
            }))
        })
    } catch (error: any) {
        console.error('[GET /api/v1/club/chat/channels] Error:', error)
        return NextResponse.json(
            { success: false, error: ClubChatError.INTERNAL_ERROR, message: `获取频道列表失败: ${error?.message?.slice(0, 100) || '未知错误'}` },
            { status: 500 }
        )
    }
}

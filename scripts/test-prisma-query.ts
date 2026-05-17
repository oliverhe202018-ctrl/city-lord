import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function test() {
    try {
        const posts = await prisma.posts.findMany({
            where: { status: 'ACTIVE', visibility: 'PUBLIC' },
            take: 10 + 1,
            cursor: { id: '123' },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            include: {
                user: { select: { id: true, nickname: true, avatar_url: true, level: true } },
                _count: { select: { likes: true, comments: true } },
                comments: {
                    where: { status: 'ACTIVE' },
                    take: 3,
                    orderBy: { created_at: 'asc' },
                    include: { user: { select: { id: true, nickname: true, avatar_url: true } } }
                }
            }
        })
        console.log("Success", posts.length)
    } catch (e: any) {
        console.error("Prisma error:", e.message)
    }
}

test().finally(() => prisma.$disconnect())

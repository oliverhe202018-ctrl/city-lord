
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('--- Task Center Debug ---')
    console.log('Time:', new Date().toISOString())

    // 1. Check Tasks
    const tasks = await prisma.task.findMany()
    console.log(`Found ${tasks.length} tasks in DB.`)
    if (tasks.length > 0) {
        console.log('Sample Task:', tasks[0])
    } else {
        console.warn('WARNING: No tasks found! Seed might have failed.')
    }

    // 2. Check UserTaskProgress
    const progressCount = await prisma.userTaskProgress.count()
    console.log(`Found ${progressCount} UserTaskProgress records.`)

    if (progressCount > 0) {
        const sample = await prisma.userTaskProgress.findFirst({
            include: { task: true }
        })
        console.log('Sample Progress:', sample)
    }

    // 3. Check Users
    const users = await prisma.profiles.findMany({ select: { id: true }, take: 1 })
    console.log('User:', users[0])

    if (users.length > 0 && tasks.length > 0) {
        const userId = users[0].id
        const taskId = tasks[0].id
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24) // +1 day

        console.log('Testing Write...')
        try {
            // Try findUnique
            const exists = await prisma.userTaskProgress.findUnique({
                where: {
                    userId_taskId_expiresAt: {
                        userId,
                        taskId,
                        expiresAt
                    }
                }
            })
            console.log('FindUnique Result:', exists)

            if (!exists) {
                const created = await prisma.userTaskProgress.create({
                    data: {
                        userId,
                        taskId,
                        expiresAt,
                        status: 'IN_PROGRESS',
                        currentValue: 0
                    }
                })
                console.log('Created Progress:', created.id)
            }
        } catch (e: any) {
            console.error('Write Test Failed:', e.message)
        }
    }

}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())

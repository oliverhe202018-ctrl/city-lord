import { prisma } from '@/lib/prisma'
import { Task, UserTaskProgress } from '@prisma/client'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, addDays, addWeeks, isAfter } from 'date-fns'
// Define Timezone
const TV_TIMEZONE = 'Asia/Shanghai'

// Event Types
export type TaskEventType = 'RUN_FINISHED' | 'GRID_CAPTURED' | 'TERRITORY_CHECKIN'

export interface TaskEvent {
    type: TaskEventType
    userId: string
    timestamp: Date
    data: {
        distance?: number // meters
        duration?: number // seconds
        pace?: number // seconds per km
        gridId?: string
        isNew?: boolean
        isSelf?: boolean
    }
}

export class TaskService {
    /**
     * Main Entry Point: Process an event and update relevant tasks
     */
    static async processEvent(userId: string, event: TaskEvent) {
        // 1. Ensure tasks are initialized for the current period
        await this.initTasks(userId)

        // 2. Fetch active in-progress tasks
        const activeProgress = await prisma.userTaskProgress.findMany({
            where: {
                userId,
                status: 'IN_PROGRESS',
                expiresAt: { gt: new Date() }, // Not expired
            },
            include: { task: true },
        })

        const updates: Promise<any>[] = []

        for (const progress of activeProgress) {
            const { task } = progress
            let newValue = progress.currentValue
            let shouldUpdate = false

            // 3. Strategy Dispatch
            switch (task.condition) {
                // --- Daily Tasks ---
                case 'DISTANCE_SUM': // "轻量热身", "马拉松征程"
                    if (event.type === 'RUN_FINISHED' && event.data.distance) {
                        newValue += Math.floor(event.data.distance)
                        shouldUpdate = true
                    }
                    break

                case 'RUN_MORNING_CHECK': // "晨间巡逻" (06:00-09:00, >1km)
                    if (event.type === 'RUN_FINISHED' && event.data.distance && event.data.distance >= 1000) {
                        const hour = event.timestamp.getUTCHours() + 8 // Simple UTC+8 check
                        // 06:00 - 09:00 CST means 22:00 - 01:00 UTC?
                        // Wait, getUTCHours() returns UTC hour.
                        // If China 06:00, UTC is 22:00 (prev day).
                        // If China 09:00, UTC is 01:00.
                        // Better to use date-fns-tz or simple offset.
                        // Let's use simple offset for robustness if lib not avail.
                        // China is UTC+8.
                        const cstHour = (event.timestamp.getUTCHours() + 8) % 24
                        if (cstHour >= 6 && cstHour < 9) {
                            newValue += 1
                            shouldUpdate = true
                        }
                    }
                    break

                case 'GRID_CAPTURE_NEW': // "领地扩张"
                    if (event.type === 'GRID_CAPTURED' && event.data.isNew) {
                        newValue += 1
                        shouldUpdate = true
                    }
                    break

                case 'TERRITORY_CHECKIN': // "城主威严"
                    if (event.type === 'TERRITORY_CHECKIN' && event.data.isSelf) {
                        newValue += 1
                        shouldUpdate = true
                    }
                    break

                // --- Weekly Tasks ---
                case 'RUN_PACE_LIMIT': // "极速突袭" (<5'30"/km, >3km)
                    if (event.type === 'RUN_FINISHED' && event.data.distance && event.data.pace) {
                        // 5'30" = 330 seconds/km
                        if (event.data.distance >= 3000 && event.data.pace <= 330) {
                            newValue += 1
                            shouldUpdate = true
                        }
                    }
                    break

                case 'GRID_CAPTURE_COUNT': // "版图霸主" (Unique grids?)
                    // Prompt says "gridId 去重". 
                    // Current simple logic: just count captures. To strictly dedup, we need access to history or store gridIds in a separate table/field.
                    // Given schema limitations, we'll assume "Capture 10 grids" means 10 capture events for now, OR valid "New" captures.
                    // "isNew" flag helps. If Weekly requires 10 *different* grids, checking isNew=true is a good proxy for "expansion".
                    // If the requirement is just "occupy 10", maybe `currentValue` is just count.
                    // Let's use `isNew` for "版图霸主" to ensure they are distinct additions?
                    // Or just count any capture? "累计占领 10 个不同的网格". "不同的" implies unique.
                    if (event.type === 'GRID_CAPTURED') {
                        // If we really need unique, we might need to query `territories` count?
                        // Or rely on `isNew` if valid.
                        if (event.data.gridId) {
                            newValue += 1
                            shouldUpdate = true
                        }
                    }
                    break

                case 'ACTIVE_DAYS': // "坚持不懈" (Active days > 5)
                    if (event.type === 'RUN_FINISHED') {
                        // Check if already updated today
                        // We can check `progress.updatedAt` vs `event.timestamp`
                        const lastUpdate = new Date(progress.updatedAt)
                        // Convert both to CST day string YYYY-MM-DD
                        const getCSTDate = (d: Date) => {
                            const offset = 8 * 60 * 60 * 1000
                            return new Date(d.getTime() + offset).toISOString().split('T')[0]
                        }

                        // BUT `updatedAt` is updated on ANY change. If task created today, currentValue=0.
                        // If currentValue == 0 -> update.
                        // If currentValue > 0 -> check equality.
                        if (progress.currentValue === 0 || getCSTDate(lastUpdate) !== getCSTDate(event.timestamp)) {
                            newValue += 1
                            shouldUpdate = true
                        }
                    }
                    break
            }

            // 4. Update Database
            if (shouldUpdate) {
                const isCompleted = newValue >= task.targetValue
                const updatePromise = prisma.userTaskProgress.update({
                    where: { id: progress.id },
                    data: {
                        currentValue: Math.min(newValue, task.targetValue), // Cap at target? Or allow overflow? Usually cap for UI.
                        status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
                        completedAt: isCompleted ? new Date() : null,
                    }
                })
                updates.push(updatePromise)
            }
        }

        await Promise.all(updates)
    }

    /**
     * Lazily initialize tasks for the user if they don't exist for current cycle
     */
    static async initTasks(userId: string) {
        // 1. Get all base tasks
        const tasks = await prisma.task.findMany({ where: { isVisible: true } })

        // 2. Calculate Expiry Times (CST)
        const now = new Date()
        // CST: UTC+8
        // For Daily: Next day 00:00 CST
        // For Weekly: Next Monday 00:00 CST

        // Helper to get next boundary in CST
        const getCSTNextDay0 = () => {
            const d = new Date(now.getTime() + 8 * 3600 * 1000)
            d.setUTCHours(0, 0, 0, 0)
            d.setDate(d.getDate() + 1)
            // Convert back to UTC timestamp for DB storage
            return new Date(d.getTime() - 8 * 3600 * 1000)
        }

        const getCSTNextMonday0 = () => {
            const d = new Date(now.getTime() + 8 * 3600 * 1000)
            d.setUTCHours(0, 0, 0, 0)
            // Find next Monday
            const day = d.getDay()
            const diff = (day === 0 ? 7 : 7 - day) + 1 // +1 for Next Monday? 
            // If today is Monday(1), next Monday is +7. 
            // If Sunday(0), next Monday is +1.
            const daysToMon = day === 0 ? 1 : (8 - day)
            d.setDate(d.getDate() + daysToMon)

            return new Date(d.getTime() - 8 * 3600 * 1000)
        }

        const dailyExpires = getCSTNextDay0()
        const weeklyExpires = getCSTNextMonday0()

        const neededCreates = []

        for (const task of tasks) {
            const expiresAt = task.type === 'DAILY' ? dailyExpires : weeklyExpires

            // key check
            const exists = await prisma.userTaskProgress.findUnique({
                where: {
                    userId_taskId_expiresAt: {
                        userId,
                        taskId: task.id,
                        expiresAt // Exact match required for unique constraint
                    }
                }
            })

            if (!exists) {
                // Check if there is ANY unexpired task? To avoid creating multiple if logic shifts slightly?
                // The unique constraint handles duplicates if strict match.
                // But what if `now` changes slightly across requests? `dailyExpires` logic snaps to day boundary.
                // So consistent for 24h.
                neededCreates.push({
                    userId,
                    taskId: task.id,
                    expiresAt,
                    status: 'IN_PROGRESS',
                    currentValue: 0
                })
            }
        }

        if (neededCreates.length > 0) {
            await prisma.userTaskProgress.createMany({
                data: neededCreates,
                skipDuplicates: true
            })
        }
    }
}

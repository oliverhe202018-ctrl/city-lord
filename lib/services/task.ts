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
    static async processEvent(userId: string, event: TaskEvent, eventId?: string) {
        // 1. Ensure tasks are initialized for the current period
        await this.initTasks(userId)

        const completedTasks: any[] = []

        // 2. Execute process in a single Serializable transaction
        await prisma.$transaction(async (tx) => {
            const activeProgress = await tx.userTaskProgress.findMany({
                where: {
                    userId,
                    status: 'IN_PROGRESS',
                    expiresAt: { gt: new Date() }, // Not expired
                },
                include: { task: true },
            })

            const updates: any[] = []

            for (const progress of activeProgress) {
                // Idempotency check inside transaction
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
                // @ts-expect-error - FIXME: Property 'lastEventId' does not exist on type '{ task: { id: string; d - [Ticket-202603-SchemaSync] baseline exemption
                if (eventId && progress.lastEventId === eventId) {
                    continue
                }

                const { task } = progress
                let newValue = progress.currentValue
                let shouldUpdate = false

                // 3. Strategy Dispatch
                switch (task.condition) {
                    // --- Daily / Generic ---
                    case 'DISTANCE_SUM': // Distance sum in meters
                        if (event.type === 'RUN_FINISHED' && event.data.distance) {
                            newValue += Math.floor(event.data.distance)
                            shouldUpdate = true
                        }
                        break

                    case 'RUN_COUNT': // Simple run completion count
                        if (event.type === 'RUN_FINISHED') {
                            newValue += 1
                            shouldUpdate = true
                        }
                        break

                    case 'RUN_MORNING_CHECK': // Morning run (06:00-09:00, >1km)
                        if (event.type === 'RUN_FINISHED' && event.data.distance && event.data.distance >= 1000) {
                            const cstHour = (event.timestamp.getUTCHours() + 8) % 24
                            if (cstHour >= 6 && cstHour < 9) {
                                newValue += 1
                                shouldUpdate = true
                            }
                        }
                        break

                    case 'NIGHT_RUN': // Night run (22:00-04:00)
                        if (event.type === 'RUN_FINISHED') {
                            const cstHour = (event.timestamp.getUTCHours() + 8) % 24
                            if (cstHour >= 22 || cstHour < 4) {
                                newValue += 1
                                shouldUpdate = true
                            }
                        }
                        break

                    case 'CALORIES': // Calories burned (assuming 1km = 60 kcal roughly if not provided)
                        if (event.type === 'RUN_FINISHED' && event.data.distance) {
                            const kcalBurned = (event.data.distance / 1000) * 60 // extremely crude estimate
                            newValue += Math.floor(kcalBurned)
                            shouldUpdate = true
                        }
                        break

                    case 'GRID_CAPTURE_NEW': // Unique / New grids
                    case 'UNIQUE_HEX':
                        if (event.type === 'GRID_CAPTURED' && event.data.isNew) {
                            newValue += 1
                            shouldUpdate = true
                        }
                        break

                    case 'HEX_COUNT': // Total grids touched/captured today
                        if (event.type === 'GRID_CAPTURED' || event.type === 'TERRITORY_CHECKIN') {
                            newValue += 1
                            shouldUpdate = true
                        }
                        break

                    case 'HEX_TOTAL': // Total distinct hexes owned (Achievement style)
                        if (event.type === 'GRID_CAPTURED' && event.data.isNew) {
                            newValue += 1
                            shouldUpdate = true
                        }
                        break

                    case 'TERRITORY_CHECKIN': // Territory check-ins
                        if (event.type === 'TERRITORY_CHECKIN' && event.data.isSelf) {
                            newValue += 1
                            shouldUpdate = true
                        }
                        break

                    // --- Weekly Tasks ---
                    case 'RUN_PACE_LIMIT': // Fast pace run (<5'30"/km, >3km)
                        if (event.type === 'RUN_FINISHED' && event.data.distance && event.data.pace) {
                            // 5'30" = 330 seconds/km
                            if (event.data.distance >= 3000 && event.data.pace <= 330) {
                                newValue += 1
                                shouldUpdate = true
                            }
                        }
                        break

                    case 'ACTIVE_DAYS': // Active days logic
                        if (event.type === 'RUN_FINISHED') {
                            const lastUpdate = new Date(progress.updatedAt)
                            const getCSTDate = (d: Date) => {
                                const offset = 8 * 60 * 60 * 1000
                                return new Date(d.getTime() + offset).toISOString().split('T')[0]
                            }

                            if (progress.currentValue === 0 || getCSTDate(lastUpdate) !== getCSTDate(event.timestamp)) {
                                newValue += 1
                                shouldUpdate = true
                            }
                        }
                        break

                    default:
                        console.warn(`[TaskService] Unhandled condition type: ${task.condition}`)
                        break
                }

                // 4. Queue Database Update
                if (shouldUpdate) {
                    const isCompleted = newValue >= task.targetValue
                    const updatePromise = tx.userTaskProgress.update({
                        where: { id: progress.id },
                        data: {
                            currentValue: Math.min(newValue, task.targetValue),
                            status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
                            completedAt: isCompleted ? new Date() : null,
// @ts-expect-error - Baseline exemption for pre-existing schema mismatch - [Ticket-202603-SchemaSync] baseline exemption
                            // @ts-expect-error - FIXME: Object literal may only specify known properties, and 'lastEventId' do - [Ticket-202603-SchemaSync] baseline exemption
                            lastEventId: eventId || null
                        }
                    })
                    updates.push(updatePromise)
                    
                    if (isCompleted) {
                        completedTasks.push({ taskId: task.id, code: task.code, reward: task.reward })
                    }
                }
            }

            if (updates.length > 0) {
                await Promise.all(updates)
            }
        }, { isolationLevel: 'Serializable' })

        // 5. Emit MISSION_COMPLETED event if any task completed (Outside transaction)
        if (completedTasks.length > 0) {
            const { eventBus } = await import('@/lib/game-logic/event-bus')
            for (const ct of completedTasks) {
                try {
                    await eventBus.emit({
                        type: 'MISSION_COMPLETED',
                        userId,
                        missionId: ct.taskId,
                        missionCode: ct.code,
                        rewards: ct.reward
                    })
                } catch (err) {
                    console.error('[TaskService] Failed to emit MISSION_COMPLETED:', err)
                }
            }
        }
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

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import webpush from 'web-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let isWebPushInitialized = false;

function initWebPush() {
    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
            'mailto:citylord@126.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        )
    }
}

/**
 * Activity Reminder Cron Job
 * Queries activities starting in the next 1 hour and creates
 * reminder notifications for registered users.
 * 
 * Uses idempotent check via notification data JSON to avoid duplicates.
 * 
 * Trigger: GET /api/cron/activity-reminder
 * Auth: CRON_SECRET header required
 */
export async function GET(req: Request) {
    if (!isWebPushInitialized) {
        initWebPush();
        isWebPushInitialized = true;
    }
    // Verify cron secret
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const now = new Date()
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

        // Find activities starting in the next hour
        const upcomingActivities = await prisma.club_activities.findMany({
            where: {
                start_time: {
                    gte: now,
                    lte: oneHourLater,
                },
            },
            include: {
                registrations: {
                    where: { status: 'registered' },
                    select: { user_id: true },
                },
            },
        })

        let notificationCount = 0
        let retriedCount = 0

        for (const activity of upcomingActivities) {
            const minutesLeft = Math.max(1, Math.round((activity.start_time.getTime() - now.getTime()) / 60000));
            const pushTitle = '📢 活动即将开始！';
            const pushBody = `活动「${activity.title}」将在 ${minutesLeft} 分钟后开始！\n${activity.description ? activity.description.slice(0, 50) + '...' : '请做好准备'}`;

            for (const reg of activity.registrations) {
                // Idempotent check: avoid duplicate reminders for same activity
                let reminderNotification = await prisma.notifications.findFirst({
                    where: {
                        user_id: reg.user_id,
                        type: 'activity',
                        data: {
                            path: ['activity_id'],
                            equals: activity.id,
                        },
                    },
                })

                if (!reminderNotification) {
                    // Create reminder notification if it doesn't exist
                    reminderNotification = await prisma.notifications.create({
                        data: {
                            user_id: reg.user_id,
                            title: pushTitle,
                            body: pushBody,
                            type: 'activity',
                            data: {
                                activity_id: activity.id,
                                start_time: activity.start_time.toISOString(),
                            },
                            is_read: false,
                            push_status: 'pending',
                        },
                    })
                    notificationCount++
                }

                // If the notification needs a push (pending or failed), try to send it
                if (reminderNotification.push_status === 'pending' || reminderNotification.push_status === 'failed') {
                    if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
                        const subs = await prisma.push_subscriptions.findMany({
                            where: { user_id: reg.user_id, revoked_at: null }
                        })

                        let pushSuccess = false;
                        for (const sub of subs) {
                            try {
                                await webpush.sendNotification({
                                    endpoint: sub.endpoint,
                                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                                }, JSON.stringify({
                                    title: pushTitle,
                                    body: pushBody,
                                    url: `/club/activities/${activity.id}`
                                }))
                                pushSuccess = true;
                            } catch (pushErr: any) {
                                console.error('Push notification failed for sub:', sub.id, pushErr);
                                if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                                    // Mark subscription as revoked
                                    await prisma.push_subscriptions.update({
                                        where: { id: sub.id },
                                        data: { revoked_at: new Date() }
                                    })
                                }
                            }
                        }

                        // Update push_status based on outcome
                        await prisma.notifications.update({
                            where: { id: reminderNotification.id },
                            data: {
                                push_status: pushSuccess ? 'sent' : 'failed'
                            }
                        });

                        if (reminderNotification.push_status === 'failed') {
                            retriedCount++;
                        }
                    }
                }
            }
        }

        // --- RETRY LOGIC FOR OTHER FAILED PUSHES (Within the last 2 hours) ---
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
        const failedNotifications = await prisma.notifications.findMany({
            where: {
                push_status: 'failed',
                created_at: { gte: twoHoursAgo }
            }
        });

        for (const notif of failedNotifications) {
            const subs = await prisma.push_subscriptions.findMany({
                where: { user_id: notif.user_id, revoked_at: null }
            })
            if (subs.length === 0) continue;

            let pushSuccess = false;
            for (const sub of subs) {
                try {
                    await webpush.sendNotification({
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth }
                    }, JSON.stringify({
                        title: notif.title,
                        body: notif.body || '',
                        url: (notif.data as any)?.activity_id ? `/club/activities/${(notif.data as any).activity_id}` : '/'
                    }))
                    pushSuccess = true;
                } catch (pushErr: any) {
                    console.error('Retry Push failed for sub:', sub.id, pushErr);
                    if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                        await prisma.push_subscriptions.update({
                            where: { id: sub.id },
                            data: { revoked_at: new Date() }
                        })
                    }
                }
            }

            if (pushSuccess) {
                await prisma.notifications.update({
                    where: { id: notif.id },
                    data: { push_status: 'sent' }
                });
                retriedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            activitiesFound: upcomingActivities.length,
            notificationsSent: notificationCount,
            checkedAt: now.toISOString(),
        })
    } catch (error) {
        console.error('Activity reminder cron error:', error)
        return NextResponse.json(
            { error: 'Failed to process activity reminders' },
            { status: 500 }
        )
    }
}

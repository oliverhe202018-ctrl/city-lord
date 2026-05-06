'use server';

import { prisma } from '@/lib/prisma';

export async function seedDatabase() {
    try {
        // strict checking
        console.log('Starting database seed check...');

        // Example: Check if any mission configs exist, if not, create default
        const missionCount = await prisma.mission_configs.count();

        if (missionCount === 0) {
            console.log('Seeding default mission configs...');
            await prisma.mission_configs.create({
                data: {
                    code: 'daily_login',
                    title: 'Daily Login',
                    description: 'Log in to the game every day',
                    points_reward: 10,
                    frequency: 'daily'
                }
            });
            return { success: true, message: 'Seeded default data.' };
        }

        return { success: true, message: 'Database already seeded.' };
    } catch (error) {
        console.error('Seed failed:', error);
        return { success: false, error: String(error) };
    }
}

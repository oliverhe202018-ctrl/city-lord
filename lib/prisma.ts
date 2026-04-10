import type { PrismaClient } from '@prisma/client';
import pkg from '@prisma/client';

const { PrismaClient: PrismaClientValue } = pkg as any;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

const basePrisma = globalForPrisma.prisma || new PrismaClientValue();

export const prisma = basePrisma.$extends({});

export type ExtendedPrismaClient = typeof prisma;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

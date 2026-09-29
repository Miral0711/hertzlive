import { PrismaClient } from '@prisma/client';

// Single shared client, per Prisma's guidance for long-running Node processes.
export const prisma = new PrismaClient();

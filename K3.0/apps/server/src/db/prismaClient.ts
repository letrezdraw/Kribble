import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function initDatabase() {
  await prisma.$connect()
}

export async function isDatabaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export { prisma }

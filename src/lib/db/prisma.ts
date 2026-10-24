import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Development reloads can retain an instance created before these models existed.
const cachedPrisma = globalForPrisma.prisma;
export const prisma =
  cachedPrisma?.organizationEmailIntegration &&
  cachedPrisma?.organizationEmailOAuthAttempt &&
  cachedPrisma?.hrEmailDelivery
    && cachedPrisma?.employeeFinalPay
    && cachedPrisma?.employeeFinalPayPayment
    && cachedPrisma?.employeeFinalPayAudit
    ? cachedPrisma
    : new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

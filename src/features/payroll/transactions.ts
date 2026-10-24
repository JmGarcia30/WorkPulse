import { Prisma, PrismaClient } from '@prisma/client';

export type PayrollDb = Prisma.TransactionClient | PrismaClient;

/** All service entry points share the period lock, including generation/review/finalize. */
export async function lockPayrollPeriod(db: Prisma.TransactionClient, organizationId: string, periodId: string) {
  await db.$queryRaw(Prisma.sql`SELECT id FROM "PayrollPeriod" WHERE id = ${periodId} AND "organizationId" = ${organizationId} FOR UPDATE`);
}

export async function lockPayrollEmployee(db: Prisma.TransactionClient, organizationId: string, employeeId: string) {
  // The lock spans contribution months AND payment years (including cross-year pay dates).
  await db.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([organizationId, employeeId])}, 0))::text`);
}

export async function payrollTransaction<T>(db: PayrollDb, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if (!('$transaction' in db)) return work(db);
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 120_000 }); }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') || attempt >= 2) throw error;
    }
  }
}

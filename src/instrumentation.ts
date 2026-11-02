export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { databaseTarget, verifyDatabaseIdentity, assertHostedSessionSecret } = await import('./lib/db/environment-safety');
  const target = databaseTarget();
  if (!target) return;
  assertHostedSessionSecret();
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ log: [] });
  try {
    const identity = await verifyDatabaseIdentity(target, () => db.$queryRaw`
      SELECT current_database() AS database,
             current_setting('neon.branch_id', true) AS branch_id,
             current_setting('neon.endpoint_id', true) AS endpoint_id
    `);
    console.info('[WorkPulse database identity]', JSON.stringify({ environment: process.env.VERCEL_ENV, deployment: process.env.VERCEL_DEPLOYMENT_ID, commit: process.env.VERCEL_GIT_COMMIT_SHA, ...identity }));
  } catch {
    throw new Error('WORKPULSE_DATABASE_IDENTITY_REJECTED');
  } finally { await db.$disconnect(); }
}

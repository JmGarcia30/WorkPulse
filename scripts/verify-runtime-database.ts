// Run inside the intended server environment, with its captured environment.
// A local run proves only that local process's connection, never a deployment binding.
import { PrismaClient } from '@prisma/client';
import { databaseTarget, verifyDatabaseIdentity } from '../src/lib/db/environment-safety';

async function main() {
  const target = databaseTarget();
  if (!target) throw new Error('IDENTITY_CONFIGURATION_REQUIRED');
  const db = new PrismaClient({ log: [] });
  try {
    const identity = await verifyDatabaseIdentity(target, () => db.$queryRaw`
      SELECT current_database() AS database,
             current_setting('neon.branch_id', true) AS branch_id,
             current_setting('neon.endpoint_id', true) AS endpoint_id
    `);
    console.log(JSON.stringify({ environment: process.env.VERCEL_ENV, deployment: process.env.VERCEL_DEPLOYMENT_ID,
      commit: process.env.VERCEL_GIT_COMMIT_SHA, ...identity }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('WORKPULSE_DATABASE_IDENTITY_REJECTED'); process.exitCode = 1; });

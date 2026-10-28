/* eslint-disable @typescript-eslint/no-require-imports -- Operator-only, read-only credential-free target inspection. */
// Supply DATABASE_URL securely in the process environment. Does not load .env.
const { createHash } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('POSTGRES_TARGET_REQUIRED');
  const identity = [url.hostname.replace('-pooler.', '.'), url.port || '5432', url.pathname, url.searchParams.get('schema') || 'public'].join('|');
  const fingerprint = createHash('sha256').update(identity).digest('hex');
  url.searchParams.set('options', ((url.searchParams.get('options') || '') + ' -c default_transaction_read_only=on').trim());
  const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
  try {
    const [state] = await db.$queryRaw`SELECT current_setting('neon.branch_id', true) AS branch_id, current_setting('neon.endpoint_id', true) AS endpoint_id, current_setting('default_transaction_read_only') AS read_only`;
    if (state.read_only !== 'on') throw Error('READ_ONLY_REQUIRED');
    const administratorCount = await db.platformAdministrator.count();
    console.log(JSON.stringify({ fingerprint, branchId: state.branch_id, endpointId: state.endpoint_id, readOnly: true, administratorCount }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('READ_ONLY_INSPECTION_FAILED: verify the securely supplied target and schema.'); process.exitCode = 1; });

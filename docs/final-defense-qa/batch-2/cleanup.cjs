const fs = require('node:fs'), assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { profiles, scrub } = require('../qa-runner.cjs');
async function main() {
  const owned = fs.readFileSync('docs/final-defense-qa/batch-2/evidence/owned-schemas.jsonl', 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const profile = profiles['.env.recovery.local'], url = new URL(profile.H10_TEST_DATABASE_URL);
  assert.notEqual(url.hostname.replace('-pooler.', '.'), new URL(profiles['.env'].DATABASE_URL).hostname.replace('-pooler.', '.'));
  const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
  const removed = [];
  try {
    const identity = (await db.$queryRawUnsafe("SELECT current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id"))[0];
    assert.equal(identity.branch_id, profile.WORKPULSE_TEST_NEON_BRANCH_ID); assert.equal(identity.endpoint_id, profile.WORKPULSE_TEST_NEON_ENDPOINT_ID);
    for (const record of owned) { assert.equal(record.identity.branch_id, identity.branch_id); assert.equal(record.identity.endpoint_id, identity.endpoint_id); }
    for (const schema of new Set(owned.map(record => record.schema))) {
      assert.match(schema, /^(batch2_otp_|batch3_test_|staff_auth_test_)[a-f0-9]{24}$/);
      await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      assert.equal((await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema)).length, 0); removed.push(schema);
    }
    fs.writeFileSync('docs/final-defense-qa/batch-2/cleanup.json', JSON.stringify({ capturedAt: new Date().toISOString(), status: 'PASS', identity, onlyBatch2ManifestSchemas: true, productionEndpointExcluded: true, removed }, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'PASS', removedSchemas: removed.length }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(scrub(error.message)); process.exitCode = 1; });

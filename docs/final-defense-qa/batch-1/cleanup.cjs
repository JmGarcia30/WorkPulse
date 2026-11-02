const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { profiles, scrub } = require('../qa-runner.cjs');

async function main() {
  const owned = ['before', 'before-verified', 'after'].flatMap(phase => {
    const file = `docs/final-defense-qa/batch-1/${phase}/owned-schemas.jsonl`;
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
  });
  const expected = profiles['.env.recovery.local'];
  const target = new URL(expected.H10_TEST_DATABASE_URL);
  const protectedTarget = new URL(profiles['.env'].DATABASE_URL);
  assert.notEqual(target.hostname.replace('-pooler.', '.'), protectedTarget.hostname.replace('-pooler.', '.'));
  const db = new PrismaClient({ datasources: { db: { url: target.href } }, log: [] });
  const removed = [];
  try {
    const identity = (await db.$queryRawUnsafe("SELECT current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id"))[0];
    assert.equal(identity.branch_id, expected.WORKPULSE_TEST_NEON_BRANCH_ID);
    assert.equal(identity.endpoint_id, expected.WORKPULSE_TEST_NEON_ENDPOINT_ID);
    for (const record of owned) { assert.equal(record.identity.branch_id, identity.branch_id); assert.equal(record.identity.endpoint_id, identity.endpoint_id); }
    for (const schema of new Set(owned.map(record => record.schema))) {
      assert.match(schema, /^(batch3_test_|staff_auth_test_)[a-f0-9]{24}$/);
      await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
      assert.equal((await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema)).length, 0);
      removed.push(schema);
    }
    const result = { capturedAt: new Date().toISOString(), status: 'PASS', identity, manifestOnly: true, productionEndpointExcluded: true, removed };
    fs.writeFileSync('docs/final-defense-qa/batch-1/cleanup.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ status: 'PASS', removedSchemas: removed.length }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(scrub(error.message)); process.exitCode = 1; });

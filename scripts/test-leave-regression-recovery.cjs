/* eslint-disable @typescript-eslint/no-require-imports -- Existing H5 suite, explicitly recovery-only. */
const fs = require('node:fs'), assert = require('node:assert/strict'), Module = require('node:module');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verification = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.endpointSha256 !== verification.identity.endpointSha256 || config.identity.branchId !== verification.identity.branchId) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
require('tsx/cjs');
const original = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'server-only') return {};
  if (name === '@/lib/db/prisma' || name === '../src/lib/db/prisma') return { prisma: db };
  return original.call(this, name, parent, main);
};
(async () => {
  const sagaBefore = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
  const columns = await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'Leave%' ORDER BY table_name,ordinal_position`;
  const before = await helper.fingerprints(db, columns);
  await require('./test-h5-leave-management.ts').runH5LeaveManagement();
  assert.deepEqual(await db.organization.findUniqueOrThrow({ where: { id: sagaBefore.id } }), sagaBefore);
  assert.deepEqual((await helper.fingerprints(db, columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  fs.mkdirSync('docs/leave-policy', { recursive: true });
  fs.writeFileSync('docs/leave-policy/regression.json', JSON.stringify({ passed: true, assertions: 103, branchId: config.identity.branchId, leaveDataUnchanged: true, sagaIdentityRestored: true, fixturesRollbackOnly: true }, null, 2));
})().catch(error => { console.error(error.code || error.name, error.message?.startsWith('ASSERTION FAILED:') ? error.message : '', error.stack?.split('\n').filter(line => line.includes('scripts\\test-h5') || line.includes('scripts\\assert-batch1'))); process.exitCode = 1; }).finally(async () => { Module._load = original; await db.$disconnect(); });

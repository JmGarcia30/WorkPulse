/* eslint-disable @typescript-eslint/no-require-imports -- Small read-only recovery latency probe. */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || !verified.h10ChecksumMatch || verified.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.pooled) } }, log: [] });
async function main() {
  try {
    await db.$queryRaw`SELECT 1`;
    const organization = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true } });
    const samples = [];
    for (let iteration = 0; iteration < 3; iteration++) {
      let start = performance.now();
      await db.$queryRaw`SELECT 1`;
      const roundTripMs = performance.now() - start;
      start = performance.now();
      const plan = await db.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT "id" FROM "Employee" WHERE "organizationId" = ${organization.id} LIMIT 10`;
      const explainWallMs = performance.now() - start;
      const timings = plan[0]['QUERY PLAN'][0];
      samples.push({ iteration, roundTripMs, explainWallMs, planningMs: timings['Planning Time'], databaseExecutionMs: timings['Execution Time'] });
    }
    const prior = JSON.parse(fs.readFileSync('docs/performance-audit/batch-3/data-preservation.json'));
    const baseline = JSON.parse(fs.readFileSync(helper.directory + '/protected-data-before.json'));
    const fingerprints = await helper.fingerprints(db, baseline.columns);
    const differences = fingerprints.tables.filter(row => {
      const previous = baseline.tables.find(table => table.table === row.table);
      return !previous || previous.count !== row.count || previous.fingerprint !== row.fingerprint;
    }).map(row => row.table);
    helper.assertOriginalUnchanged(config);
    const result = { branch: config.identity.branchName, samples, protectedTables: fingerprints.tables.length, differences, originalEnvUnchanged: config.identity.originalEnvSha256 === prior.identity.originalEnvSha256 };
    fs.writeFileSync('docs/performance-audit/final-ux/latency-and-preservation.json', JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    if (differences.length || !result.originalEnvUnchanged) helper.fail('PRESERVATION_DIFFERENCE');
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name, message: /^[A-Z_]+$/.test(e.message) ? e.message : undefined })); process.exitCode = 1; });

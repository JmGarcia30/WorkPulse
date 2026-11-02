// Read-only validation of the guard against the already verified rehearsal clone.
// This is NOT evidence of a Vercel runtime binding and does not repeat migrations.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript'), { PrismaClient } = require('@prisma/client');
const e = require('../environment.cjs');
const file = path.resolve('src/lib/db/environment-safety.ts'), m = new Module(file, module);
m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, file);
const { databaseTarget, verifyDatabaseIdentity } = m.exports;
async function main() {
  const url = new URL(e.connection()); url.searchParams.delete('options');
  const target = databaseTarget({ VERCEL_ENV: 'preview', DATABASE_URL: url.href,
    WORKPULSE_DB_PROJECT_ID: e.identity.project, WORKPULSE_DB_BRANCH_ID: e.identity.branch,
    WORKPULSE_DB_ENDPOINT_ID: e.identity.endpoint, WORKPULSE_DB_DATABASE: 'neondb' });
  const db = new PrismaClient({ datasources: { db: { url: url.href } }, log: [] });
  try {
    const identity = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return verifyDatabaseIdentity(target, () => tx.$queryRawUnsafe("SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id"));
    }, { timeout: 20000 });
    const result = { capturedAt: new Date().toISOString(), status: 'PASS', identity,
      providerProjectMapping: 'Confirmed independently by Neon get_branch/list_branches',
      scope: 'Local read-only guard check against rehearsal clone; not Vercel runtime or synthetic-only Preview approval',
      productionWrites: 0, migrationsExecuted: 0, externalMessages: 0 };
    fs.writeFileSync(path.join(__dirname, 'clone-identity.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(JSON.stringify({ status: 'BLOCKED', code: error.code || error.name,
  identityRejected: error.message === 'WORKPULSE_DATABASE_IDENTITY_REJECTED' })); process.exitCode = 1; });

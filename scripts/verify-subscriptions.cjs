/* eslint-disable @typescript-eslint/no-require-imports -- Guarded runner: only a randomly named schema on the verified non-production recovery branch is migrated or written. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const { parseEnv } = require('node:util');
const config = helper.configuration();
const directory = 'docs/subscriptions/verification';
fs.mkdirSync(directory, { recursive: true });
const existingChecks = process.argv.includes('--existing-checks');
const savedProfile = existingChecks ? parseEnv(fs.readFileSync('.env.subscriptions-test.local','utf8')) : null;
const schema = savedProfile ? new URL(savedProfile.DATABASE_URL).searchParams.get('schema') : 'subscription_test_' + randomBytes(12).toString('hex');
assert.match(schema, /^subscription_test_[a-f0-9]{24}$/);
assert.equal(config.identity.branchId,'br-damp-fog-azmmxhga');
assert.equal(config.identity.endpointId,'ep-wild-mud-az8yzifu');
assert(config.identity.distinctFromProtectedOriginal);
const testUrl = new URL(savedProfile?.DATABASE_URL ?? config.direct);
assert.equal(testUrl.hostname.split('.')[0],config.identity.endpointId);
testUrl.searchParams.set('schema',schema);
testUrl.searchParams.set('options',`-c search_path=${schema},public`);
testUrl.searchParams.set('connection_limit','8');
const env = { ...config.environment, DATABASE_URL: testUrl.href, H10_TEST_DATABASE_URL: testUrl.href, NODE_ENV: 'test', PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: '1', NODE_OPTIONS: '' };
const secret = randomBytes(40).toString('hex'); env.SESSION_SECRET = secret;
delete env.VERCEL_ENV;
const redacted = output => output.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]').replaceAll(secret,'[REDACTED]');
const results = [];
async function run(name,args, extra = {}) {
  const started = Date.now();
  const child = spawn(process.execPath,args,{ env:{...env,...extra}, windowsHide:true, stdio:['ignore','pipe','pipe'] });
  let output = ''; child.stdout.on('data',b => output += b); child.stderr.on('data',b => output += b);
  const exitCode = await new Promise((resolve,reject) => { child.on('exit',resolve); child.on('error',reject); });
  const result = { name, exitCode, elapsedMs:Date.now()-started };
  fs.writeFileSync(`${directory}/${name}.log`, redacted(output));
  results.push(result); console.log(JSON.stringify(result)); return { ...result, output };
}
const migrations = fs.readdirSync('prisma/migrations',{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
const bundle = path.join(process.cwd(),'.next','subscription-migration-rehearsal',schema);
const bundleMigrations = path.join(bundle,'migrations');
fs.mkdirSync(bundleMigrations,{recursive:true});
fs.copyFileSync('prisma/schema.prisma',path.join(bundle,'schema.prisma'));
fs.copyFileSync('prisma/migrations/migration_lock.toml',path.join(bundleMigrations,'migration_lock.toml'));
function copyMigration(name) { fs.cpSync(path.join('prisma/migrations',name),path.join(bundleMigrations,name),{recursive:true}); }
const foundation = '20261108000100_saas_subscription_foundation';
const manual = '20261108000200_manual_subscription_requests';
async function migrate(name) {
  const result = await run(name,['node_modules/prisma/build/index.js','migrate','deploy','--schema',path.join(bundle,'schema.prisma')]);
  assert.equal(result.exitCode,0,name + ' failed: ' + redacted(result.output).slice(-1200));
}
async function main() {
  if (existingChecks) {
    const db = new PrismaClient({datasources:{db:{url:testUrl.href}},log:[]});
    try {
      const [identity] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_schema() AS schema`;
      assert.equal(identity.branch,config.identity.branchId); assert.equal(identity.schema,schema);
      await run('final-subscription-domain',['node_modules/tsx/dist/cli.mjs','scripts/test-subscription-domain.ts']);
      await run('final-subscription-actions',['scripts/test-subscriptions.cjs']);
      await run('final-typescript',['node_modules/typescript/bin/tsc','--noEmit']);
      await run('final-prisma-validation',['node_modules/prisma/build/index.js','validate']);
      await run('final-changed-eslint',['node_modules/eslint/bin/eslint.js','src/features/subscriptions','src/features/organization-branding/actions.ts','src/app/(dashboard)/dashboard/subscription/page.tsx','src/app/platform/(protected)/subscriptions/page.tsx','src/lib/db/prisma.ts',...fs.readdirSync('scripts').filter(file=>/subscription/.test(file)).map(file=>'scripts/'+file)]);
      await run('final-production-build',['node_modules/next/dist/bin/next','build','--webpack'],{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
      helper.assertOriginalUnchanged(config);
    } finally {
      await db.$disconnect();
      fs.writeFileSync(`${directory}/final-checks.json`,JSON.stringify({schema,productionAccessed:false,originalEnvironmentUnchanged:true,results},null,2));
    }
    assert(results.every(result=>result.exitCode===0),'Final checks failed; see verification logs.');
    return;
  }
  const control = new PrismaClient({datasources:{db:{url:helper.readOnly(config.direct)}},log:[]});
  const db = new PrismaClient({datasources:{db:{url:testUrl.href}},log:[]});
  try {
    const [identity] = await control.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint`;
    assert.equal(identity.branch,config.identity.branchId); assert.equal(identity.endpoint,config.identity.endpointId);
    // CREATE SCHEMA is the sole operation on the recovery connection itself.
    const writer = new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});
    try { await writer.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); } finally { await writer.$disconnect(); }
    const [location] = await db.$queryRaw`SELECT current_schema() AS schema`;
    assert.equal(location.schema,schema);
    for (const migration of migrations.filter(name=>name!==foundation && name!==manual)) copyMigration(migration);
    await migrate('01-baseline-migrations');
    // Seed a real pre-subscription tenant, then apply each subscription migration.
    const saga = await db.organization.create({data:{ name:'Synthetic preexisting SAGA',slug:'st-aloysius' }});
    await db.user.create({data:{ organizationId:saga.id,name:'Synthetic legacy HR',email:schema+'@legacy.invalid',role:'HR_ADMIN' }});
    const before = await db.organization.findUnique({where:{id:saga.id}});
    copyMigration(foundation); await migrate('02-foundation-migration');
    copyMigration(manual); await migrate('03-manual-migration');
    assert.deepEqual(await db.organization.findUnique({where:{id:saga.id}}),before);
    assert.equal((await db.organizationSubscription.findUniqueOrThrow({where:{organizationId:saga.id}})).legacyAccess,true);
    assert.equal(await db.subscriptionPlan.count({where:{monthlyPriceMinor:null,yearlyPriceMinor:null,maxEmployees:null}}),2);
    const migrationResult = {schema,branch:identity.branch,migrations:migrations.length,existingOrganizationUnchanged:true,legacyAccessBackfilled:true,pricesAndLimitsUnset:true};
    fs.writeFileSync(`${directory}/migration-readiness.json`,JSON.stringify(migrationResult,null,2));
    // Profile is ignored by Git and never replaces the application's .env.
    fs.writeFileSync('.env.subscriptions-test.local',Object.entries(env).filter(([key])=>['DATABASE_URL','H10_TEST_DATABASE_URL','SESSION_SECRET','PLATFORM_ROOT_DOMAIN','PLATFORM_PUBLIC_ORIGIN'].includes(key)).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n'));
    await run('04-subscription-domain',['node_modules/tsx/dist/cli.mjs','scripts/test-subscription-domain.ts']);
    await run('05-subscription-actions-postgres',['scripts/test-subscriptions.cjs']);
    const preload = '--require ' + path.resolve('scripts/subscription-test-preload.cjs');
    for (const script of ['test-s1-saas-shell.ts','test-h1-employee-core.ts','test-h2-employment-probation.ts','test-h3-attendance.ts','test-h4-employee-self-service.ts','test-h5-leave-management.ts','test-h6-payroll-foundation.ts','test-payroll-integration.ts','test-rfid-attendance.ts','test-h8-analytics.ts','test-hiring-policy.cjs','test-final-ux-hiring.cjs','test-functional-dashboard-boundary.cjs']) {
      await run('regression-'+path.basename(script).replace(/\.(?:ts|cjs)$/,''),['node_modules/tsx/dist/cli.mjs','scripts/'+script],{NODE_OPTIONS:preload});
    }
    await run('06-typescript',['node_modules/typescript/bin/tsc','--noEmit']);
    await run('07-prisma-validation',['node_modules/prisma/build/index.js','validate']);
    await run('08-eslint',['node_modules/eslint/bin/eslint.js','.']);
    await run('09-production-build',['node_modules/next/dist/bin/next','build','--webpack'],{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
    const diff = await run('10-schema-diff',['node_modules/prisma/build/index.js','migrate','diff','--from-url',testUrl.href,'--to-schema-datamodel','prisma/schema.prisma','--exit-code']);
    migrationResult.prismaSchemaMatchesMigrations = diff.exitCode === 0;
    fs.writeFileSync(`${directory}/migration-readiness.json`,JSON.stringify(migrationResult,null,2));
    helper.assertOriginalUnchanged(config);
  } finally {
    await control.$disconnect(); await db.$disconnect();
    fs.writeFileSync(`${directory}/results.json`,JSON.stringify({schema,productionAccessed:false,originalEnvironmentUnchanged:true,results},null,2));
  }
  assert(results.every(result=>result.exitCode===0),'Some checks failed; see verification logs.');
}
main().catch(error=>{console.error('SUBSCRIPTION_VERIFICATION_FAILURE',error.code||error.name,redacted(String(error.message)));process.exitCode=1;});

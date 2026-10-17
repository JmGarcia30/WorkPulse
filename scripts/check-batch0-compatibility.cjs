// Read-only preflight. Never deploys migrations or prints connection URLs/row data.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
if (fs.existsSync('.env')) process.loadEnvFile('.env');
const { PrismaClient, Prisma } = require('@prisma/client');
const outputDir = 'docs/performance-audit/batch-0';
const label = process.argv[2] || 'preflight';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid snapshot label');
fs.mkdirSync(outputDir, { recursive: true });
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const targetSchema = url.searchParams.get('schema') || 'public';
  const environment = {
    classification: 'Deployment role uncertain; treat as production',
    provider: url.hostname.endsWith('.neon.tech') ? 'Neon' : 'Other',
    database: url.pathname.slice(1), schema: targetSchema,
    pooled: url.hostname.includes('-pooler.'),
    regionHint: url.hostname.match(/([a-z]+-[a-z]+-\d)\.(?:aws|azure|gcp)/)?.[1] || null,
    localEnvFile: fs.existsSync('.env'), localVercelLink: fs.existsSync('.vercel/project.json'),
    availableIntegrationVariableNames: Object.keys(process.env).filter(k => /^(VERCEL_|NEON_|H10_TEST_DATABASE_URL|DIRECT_URL|DATABASE_URL|PLATFORM_)/.test(k)),
  };
  url.searchParams.set('options', `${url.searchParams.get('options') || ''} -c default_transaction_read_only=on`.trim());
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  try {
    const snapshot = { capturedAt: new Date().toISOString(), environment };
    snapshot.server = await db.$queryRaw`SELECT current_database() AS database, current_schema() AS schema, current_setting('server_version') AS version, current_setting('default_transaction_read_only') AS read_only`;
    if (snapshot.server[0].read_only !== 'on' || snapshot.server[0].schema !== targetSchema) throw Object.assign(new Error(), { code: 'PREFLIGHT_SCOPE_MISMATCH' });
    const rows = await db.$queryRaw`SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count FROM "_prisma_migrations" ORDER BY migration_name, started_at`;
    const local = fs.readdirSync('prisma/migrations', { withFileTypes:true }).filter(e => e.isDirectory() && fs.existsSync(path.join('prisma/migrations',e.name,'migration.sql'))).map(e => {
      const bytes=fs.readFileSync(path.join('prisma/migrations',e.name,'migration.sql'));
      const sql=bytes.toString('utf8');
      const variants=[hash(bytes),hash(sql.replace(/\r\n/g,'\n')),hash(sql.replace(/\r?\n/g,'\r\n'))];
      const records=rows.filter(r=>r.migration_name===e.name);
      const effective=records.filter(r=>!r.rolled_back);
      return {name:e.name,checksum:variants[0],databaseRecords:records,checksumMatch:effective.length?effective.every(r=>variants.includes(r.checksum)):null,checksumExact:effective.length?effective.every(r=>r.checksum===variants[0]):null,rolledBackChecksumDifferences:records.filter(r=>r.rolled_back&&!variants.includes(r.checksum)).length};
    }).sort((a,b)=>a.name.localeCompare(b.name));
    snapshot.migrations=local;
    snapshot.pending=local.filter(m=>!m.databaseRecords.some(r=>r.finished&&!r.rolled_back)).map(m=>m.name);
    snapshot.unfinished=rows.filter(r=>!r.finished&&!r.rolled_back).map(r=>r.migration_name);
    snapshot.databaseOnlyMigrations=rows.filter(r=>!local.some(m=>m.name===r.migration_name)).map(r=>r.migration_name);
    const tables=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname=${targetSchema}`;
    const actualTables=new Set(tables.map(t=>t.tablename));
    const columns=await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=${targetSchema}`;
    const actualColumns=new Set(columns.map(c=>`${c.table_name}.${c.column_name}`));
    snapshot.missingTables=Prisma.dmmf.datamodel.models.filter(m=>!actualTables.has(m.dbName||m.name)).map(m=>m.dbName||m.name);
    snapshot.missingColumnsOnExistingTables=Prisma.dmmf.datamodel.models.filter(m=>actualTables.has(m.dbName||m.name)).flatMap(m=>m.fields.filter(f=>f.kind!=='object'&&!actualColumns.has(`${m.dbName||m.name}.${f.dbName||f.name}`)).map(f=>`${m.dbName||m.name}.${f.dbName||f.name}`));
    const enums=await db.$queryRaw`SELECT t.typname AS name,e.enumlabel AS value FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=${targetSchema} ORDER BY e.enumsortorder`;
    snapshot.missingEnums=Prisma.dmmf.datamodel.enums.map(e=>({name:e.dbName||e.name,missingValues:e.values.map(v=>v.dbName||v.name).filter(v=>!enums.some(x=>x.name===(e.dbName||e.name)&&x.value===v))})).filter(e=>e.missingValues.length);
    const h10=local.filter(m=>/_h10_/.test(m.name));
    const sql=h10.map(m=>fs.readFileSync(`prisma/migrations/${m.name}/migration.sql`,'utf8')).join('\n');
    snapshot.expectedTriggers=[...sql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(m=>m[1]);
    const triggers=await db.$queryRaw`SELECT t.tgname AS name,c.relname AS table_name,t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${targetSchema} AND NOT t.tgisinternal`;
    snapshot.h10Triggers=snapshot.expectedTriggers.map(name=>({name,present:triggers.some(t=>t.name===name),state:triggers.find(t=>t.name===name)?.enabled||null}));
    snapshot.probationConstraint=await db.$queryRaw`SELECT c.conname AS name,c.convalidated AS validated,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname=${targetSchema} AND c.conname='ProbationRecord_lifecycle_state_check'`;
    snapshot.h10ObjectNameCollisions={
      relations:await db.$queryRaw`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${targetSchema} AND (c.relname LIKE 'EmployeeSeparation%' OR c.relname='EmployeeClearanceItem' OR c.relname IN ('User_id_organizationId_key','Employee_id_organizationId_key','ProbationRecord_closedBySeparationCaseId_idx'))`,
      functions:await db.$queryRaw`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=${targetSchema} AND (p.proname LIKE 'Separation%' OR p.proname IN ('Employee_guard_post_separation_work','ProbationRecord_assert_separation_scope'))`,
    };
    snapshot.probationRowsRejectingNewConstraint=await db.$queryRaw`SELECT count(*)::int AS count FROM "ProbationRecord" WHERE NOT (("probationStatus"='ACTIVE' AND "decision"='PENDING' AND "completedAt" IS NULL AND "decisionAt" IS NULL AND "decisionById" IS NULL) OR ("probationStatus"='CLOSED' AND "decision"<>'PENDING' AND "completedAt" IS NOT NULL AND "decisionAt" IS NOT NULL AND "decisionById" IS NOT NULL))`;
    snapshot.preMigrationRowCounts={};
    for(const table of ['Employee','EmploymentRecord','ProbationRecord','EmployeeStatusHistory','EmploymentDecisionHistory','PayrollEntry','LeaveRequest','AttendanceEvent','DailyAttendanceRecord']) {
      const count=await db.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${table}"`);
      snapshot.preMigrationRowCounts[table]=count[0].count;
    }
    snapshot.recovery={verified:false,reason:'No authenticated Neon control-plane access or tested backup artifact available in this session.'};
    fs.writeFileSync(`${outputDir}/${label}.json`,JSON.stringify(snapshot,null,2));
    console.log(JSON.stringify({environment,pending:snapshot.pending,applied:rows.filter(r=>r.finished&&!r.rolled_back).length,checksumMismatches:local.filter(m=>m.checksumMatch===false).map(m=>m.name),unfinished:snapshot.unfinished,databaseOnly:snapshot.databaseOnlyMigrations,missingTables:snapshot.missingTables,missingColumns:snapshot.missingColumnsOnExistingTables,expectedTriggers:snapshot.expectedTriggers.length,presentH10Triggers:snapshot.h10Triggers.filter(t=>t.present).length,probationConstraintViolations:snapshot.probationRowsRejectingNewConstraint,objectCollisions:snapshot.h10ObjectNameCollisions,recovery:snapshot.recovery},null,2));
  } finally { await db.$disconnect(); }
}
main().catch(error=>{console.error(JSON.stringify({code:error.code||error.name||'PREFLIGHT_FAILED'}));process.exitCode=1;});

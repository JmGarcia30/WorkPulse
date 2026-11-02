/* Local QA only. No application changes or migrations. */
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = process.cwd();
const out = path.resolve(root, process.env.WORKPULSE_QA_EVIDENCE_DIR || 'docs/final-defense-qa/evidence');
if (!out.startsWith(path.resolve(root, 'docs/final-defense-qa') + path.sep)) throw Error('INVALID_QA_EVIDENCE_DIRECTORY');
fs.mkdirSync(out, { recursive: true });
const hash = v => createHash('sha256').update(v).digest('hex');
const profiles = Object.fromEntries(['.env', '.env.recovery.local', 'workpulse-rehearsal.env'].filter(f => fs.existsSync(f)).map(f => [f, parseEnv(fs.readFileSync(f, 'utf8'))]));
const secrets = Object.values(profiles).flatMap(e => Object.entries(e).filter(([k,v]) => /URL|SECRET|TOKEN|PASSWORD|KEY|GMAIL_USER|EMAIL_FROM/.test(k) && v.length > 5).map(([,v]) => v)).sort((a,b) => b.length-a.length);
function scrub(s) { for (const v of secrets) s = s.split(v).join('[REDACTED]'); return s.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/g, '[REDACTED_DATABASE_URL]'); }
function save(name, data) { fs.writeFileSync(path.join(out, name + '.json'), scrub(JSON.stringify(data, null, 2)) + '\n'); }
const offline = { ...process.env, DATABASE_URL: 'postgresql://qa:qa@127.0.0.1:1/qa?connect_timeout=2', H10_TEST_DATABASE_URL: 'postgresql://qa:qa@127.0.0.1:1/qa?connect_timeout=2', SESSION_SECRET: 'local-final-defense-qa-only-secret-at-least-32-chars', SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', GMAIL_USER: '', GMAIL_APP_PASSWORD: '', EMAIL_FROM: '', BLOB_READ_WRITE_TOKEN: '', GOOGLE_AI_API_KEY: '', GOOGLE_EMAIL_CLIENT_ID: '', GOOGLE_EMAIL_CLIENT_SECRET: '', EMAIL_OAUTH_ENCRYPTION_KEY: '', PLATFORM_ROOT_DOMAIN: 'localhost:3100', PLATFORM_PUBLIC_ORIGIN: 'http://localhost:3100', NEXT_TELEMETRY_DISABLED: '1', VERCEL: '0' };
async function inspect() {
  save('environment', { capturedAt: new Date().toISOString(), node: process.version, profiles: Object.entries(profiles).map(([file,e]) => ({ file, keys: Object.keys(e), sha256: hash(fs.readFileSync(file)), sessionSecretAtLeast32: (e.SESSION_SECRET || '').length >= 32, branch: e.WORKPULSE_TEST_NEON_BRANCH_ID, branchName: e.WORKPULSE_TEST_NEON_BRANCH_NAME })), protectedHashes: Object.fromEntries(Object.keys(profiles).map(f => [f, hash(fs.readFileSync(f))])), versions: Object.fromEntries(['next','prisma','@prisma/client','typescript','eslint'].map(n => [n, require(n+'/package.json').version])) });
  const { PrismaClient } = require('@prisma/client');
  const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(`prisma/migrations/${e.name}/migration.sql`)).map(e => { const sql=fs.readFileSync(`prisma/migrations/${e.name}/migration.sql`,'utf8');return { name:e.name, checksums:[hash(sql),hash(sql.replace(/\r\n/g,'\n')),hash(sql.replace(/\r?\n/g,'\r\n'))] }; });
  for (const file of ['.env', '.env.recovery.local']) {
    if (!profiles[file]?.DATABASE_URL) continue;
    const label = file === '.env' ? 'protected' : 'development';
    const raw = profiles[file].H10_TEST_DATABASE_URL || profiles[file].DATABASE_URL;
    const u = new URL(raw); u.hostname=u.hostname.replace('-pooler.','.');u.searchParams.set('options','-c default_transaction_read_only=on -c statement_timeout=15000');u.searchParams.set('connect_timeout','10');
    const db = new PrismaClient({ datasources:{db:{url:u.href}},log:[] });
    const result = { capturedAt:new Date().toISOString(), label, localMigrationCount:local.length };
    try {
      result.identity = (await db.$queryRawUnsafe("SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id"))[0];
      if(result.identity.read_only !== 'on') throw Error('READ_ONLY_NOT_ENFORCED');
      const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM public."_prisma_migrations" ORDER BY migration_name,started_at');
      result.history=rows;
      result.pending=local.filter(l=>!rows.some(r=>r.migration_name===l.name&&r.finished&&!r.rolled_back)).map(l=>l.name);
      result.checksumMismatch=local.filter(l=>rows.some(r=>r.migration_name===l.name&&r.finished&&!r.rolled_back&&!l.checksums.includes(r.checksum))).map(l=>l.name);
      result.unresolved=rows.filter(r=>!r.finished&&!r.rolled_back).map(r=>r.migration_name);
      result.unknown=rows.filter(r=>!r.rolled_back&&!local.some(l=>l.name===r.migration_name)).map(r=>r.migration_name);
      result.columns=await db.$queryRawUnsafe("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position");
      result.status='PASS';
    } catch(e) {result.status='BLOCKED';result.error={code:e.code||e.name,message:scrub(e.message)};} finally {await db.$disconnect();}
    save('database-'+label,result); console.log(label+': '+result.status+(result.pending?' pending='+result.pending.length:''));
  }
}
function run(id, args, timeout=180000) {
  const start=Date.now();const r=spawnSync(process.execPath,args,{cwd:root,env:offline,encoding:'utf8',timeout,maxBuffer:20*1024*1024,windowsHide:true});
  const log=scrub((r.stdout||'')+(r.stderr||''));fs.writeFileSync(path.join(out,id+'.log'),log);
  const result={id,command:'node '+args.join(' '),capturedAt:new Date().toISOString(),durationMs:Date.now()-start,exitCode:r.status,signal:r.signal,error:r.error?.code,status:r.status===0?'PASS':'FAIL',log:id+'.log'};save(id,result);console.log(JSON.stringify(result));
}
const mode=process.argv[2];
if(require.main===module) {
  if(mode==='inspect')inspect().catch(e=>{console.error(scrub(e.message));process.exitCode=1;});
  else if(mode==='run')run(process.argv[3],process.argv.slice(4));
}
module.exports={offline,save,scrub,run,profiles};

// Branch-scoped recovery tooling. Credentials and database row contents are never printed.
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { createHash, randomBytes } = require('node:crypto');
const directory = 'docs/performance-audit/batch-0/recovery';
const digest = b => createHash('sha256').update(b).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };
const normalize = url => url.hostname.replace('-pooler.', '.');
function configuration() {
  const originalBytes = fs.readFileSync('.env');
  const original = parseEnv(originalBytes.toString());
  const profile = parseEnv(fs.readFileSync('.env.recovery.local', 'utf8'));
  const source = new URL(original.DATABASE_URL);
  const pooled = new URL(profile.DATABASE_URL);
  const direct = new URL(profile.H10_TEST_DATABASE_URL);
  if (![pooled,direct].every(u=>u.hostname.endsWith('.neon.tech') && ['postgres:','postgresql:'].includes(u.protocol))) fail('NON_NEON_TEST_TARGET');
  if (normalize(pooled)!==normalize(direct) || pooled.pathname!==direct.pathname) fail('TEST_CONNECTION_MISMATCH');
  if (normalize(source)===normalize(pooled)) fail('PROTECTED_ORIGINAL_ENDPOINT_SELECTED');
  if ((pooled.searchParams.get('schema')||'public')!=='public' || (direct.searchParams.get('schema')||'public')!=='public') fail('UNEXPECTED_TARGET_SCHEMA');
  if (!pooled.hostname.includes('-pooler.') || direct.hostname.includes('-pooler.')) fail('UNEXPECTED_CONNECTION_TYPES');
  const metadata = {
    branchId: /^br-[a-z0-9-]+$/.test(profile.WORKPULSE_TEST_NEON_BRANCH_ID||'') ? profile.WORKPULSE_TEST_NEON_BRANCH_ID : null,
    endpointId: /^ep-[a-z0-9-]+$/.test(profile.WORKPULSE_TEST_NEON_ENDPOINT_ID||'') ? profile.WORKPULSE_TEST_NEON_ENDPOINT_ID : normalize(pooled).split('.')[0],
    checkpointBranchId: /^br-[a-z0-9-]+$/.test(profile.WORKPULSE_TEST_NEON_CHECKPOINT_BRANCH_ID||'') ? profile.WORKPULSE_TEST_NEON_CHECKPOINT_BRANCH_ID : null,
  };
  if (metadata.endpointId && normalize(pooled).split('.')[0]!==metadata.endpointId) fail('CONSOLE_ENDPOINT_MISMATCH');
  const environment = { ...process.env, ...profile, DATABASE_URL:pooled.href, H10_TEST_DATABASE_URL:direct.href,
    SESSION_SECRET: profile.SESSION_SECRET?.length>=32 ? profile.SESSION_SECRET : randomBytes(48).toString('hex'),
    GMAIL_USER:'',GMAIL_APP_PASSWORD:'',SMTP_USER:'',SMTP_PASSWORD:'',SMTP_HOST:'',BLOB_READ_WRITE_TOKEN:'',GOOGLE_AI_API_KEY:'',VERCEL:'0',
    PLATFORM_ROOT_DOMAIN:'localhost:3000',PLATFORM_PUBLIC_ORIGIN:'http://localhost:3000',NEXT_TELEMETRY_DISABLED:'1' };
  delete environment.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK;
  const identity = {branchName:'workpulse-batch0-recovery',...metadata,pooledAndDirectSameEndpoint:true,distinctFromProtectedOriginal:true,database:pooled.pathname.slice(1),schema:'public',originalEnvSha256:digest(originalBytes),endpointSha256:digest(normalize(pooled)),consoleMappingComplete:!!(metadata.branchId&&metadata.endpointId)};
  return {profile,pooled,direct,environment,identity};
}
function readOnly(url) {const result=new URL(url);result.searchParams.set('options',`${result.searchParams.get('options')||''} -c default_transaction_read_only=on`.trim());return result.href;}
function assertOriginalUnchanged(config) {if(digest(fs.readFileSync('.env'))!==config.identity.originalEnvSha256)fail('ORIGINAL_ENV_CHANGED');}
function save(name,value) {fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,name+'.json'),JSON.stringify(value,null,2));}
async function inspect() {
  const config=configuration();
  const {PrismaClient}=require('@prisma/client');
  const connections=[];
  for(const [label,url] of [['pooled',config.pooled],['direct',config.direct]]) {
    const db=new PrismaClient({datasources:{db:{url:readOnly(url)}},log:[]});
    try {
      const state=await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only`;
      if(state[0].database!==config.identity.database || state[0].schema!=='public' || state[0].read_only!=='on') fail('LIVE_TARGET_STATE_MISMATCH');
      const migrations=await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
      connections.push({label,state:state[0],migrations});
    } finally {await db.$disconnect();}
  }
  if(JSON.stringify(connections[0].migrations)!==JSON.stringify(connections[1].migrations))fail('LIVE_CONNECTION_HISTORY_MISMATCH');
  assertOriginalUnchanged(config);
  const result={capturedAt:new Date().toISOString(),...config.identity,connections};save('connection-verification',result);
  console.log(JSON.stringify({identity:config.identity,liveConnections:connections.map(x=>({label:x.label,...x.state,appliedMigrations:x.migrations.filter(m=>m.finished&&!m.rolled_back).length})),originalEnvUnchanged:true}));
}
async function fingerprints(db, prior) {
  const columns=prior || await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name<>'_prisma_migrations' ORDER BY table_name,ordinal_position`;
  const tables=[...new Set(columns.map(c=>c.table_name))];const result=[];
  const quote=s=>'"'+s.replaceAll('"','""')+'"';
  for(const table of tables){
    const selection=columns.filter(c=>c.table_name===table).map(c=>quote(c.column_name)).join(',');
    const rows=await db.$queryRawUnsafe(`SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' ORDER BY md5(row_to_json(x)::text)),'')) AS fingerprint FROM (SELECT ${selection} FROM public.${quote(table)}) x`);
    result.push({table,...rows[0]});
  }
  return {columns,tables:result};
}
module.exports={configuration,readOnly,assertOriginalUnchanged,save,directory,fail,fingerprints,digest};
if(require.main===module)inspect().catch(e=>{console.error(JSON.stringify({code:e.code||e.name}));process.exitCode=1;});

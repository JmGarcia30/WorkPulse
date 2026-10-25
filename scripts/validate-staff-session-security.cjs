/* eslint-disable @typescript-eslint/no-require-imports -- Only new isolated test schemas on the pinned authorized development endpoint; never selects production. */
const fs=require('node:fs'),{spawn}=require('node:child_process'),{randomBytes,createHash}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const helper=require('./batch0-recovery-environment.cjs');
const config=helper.configuration();
if(config.identity.branchName!=='workpulse-ess-design'||config.identity.branchId!=='br-damp-fog-azmmxhga'||config.identity.endpointId!=='ep-wild-mud-az8yzifu')throw Error('UNAUTHORIZED_TEST_DATABASE');
const protectedPaths=['.env','.env.recovery.local','scripts/batch0-recovery-environment.cjs','scripts/dev-recovery.cjs','scripts/execute-batch0-recovery.cjs'];
const hashes=()=>Object.fromEntries(protectedPaths.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const baseline=hashes(),schema='staff_auth_test_'+randomBytes(12).toString('hex');
const reader=new PrismaClient({datasources:{db:{url:helper.readOnly(config.direct)}},log:[]});
const control=new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});
async function command(args,env){
 let output='';const child=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
 const exitCode=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});
 const messages=output.split(/\r?\n/).filter(line=>/^PASS \d+:|^\{"passed":/.test(line));
 for(const line of messages)console.log(line);
 if(exitCode)throw Object.assign(Error('FOCUSED_VALIDATION_FAILED'),{safeDiagnostics:messages.slice(-3)});
}
async function main(){
 let created=false,before;
 try{
  const [identity]=await reader.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint,current_setting('default_transaction_read_only') AS read_only`;
  if(identity.branch!==config.identity.branchId||identity.endpoint!==config.identity.endpointId||identity.read_only!=='on')throw Error('DEVELOPMENT_IDENTITY_MISMATCH');
  const columns=await reader.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('User','Employee','EmployeeAccount','AttendanceEvent','DailyAttendanceRecord','PlatformAuthenticationAttempt','RfidKioskSession') ORDER BY table_name,ordinal_position`;
  before=await helper.fingerprints(reader,columns);
  if(!/^staff_auth_test_[a-f0-9]{24}$/.test(schema))throw Error('INVALID_TEST_SCHEMA');
  await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);created=true;
  const url=new URL(config.direct);url.searchParams.set('schema',schema);url.searchParams.set('options','-c search_path='+schema+',public');
  const env={...config.environment,DATABASE_URL:url.href,H10_TEST_DATABASE_URL:url.href,NODE_ENV:'production',NODE_OPTIONS:'',PLATFORM_ROOT_DOMAIN:'staff-security-preview.vercel.app',PLATFORM_PUBLIC_ORIGIN:'https://staff-security-preview.vercel.app'};
  // Applies committed SQL only inside the newly created empty fixture schema.
  // Does not apply the new migration or any changes to public/development records.
  await command(['node_modules/prisma/build/index.js','migrate','deploy'],env);
  await command(['scripts/test-staff-session-security.cjs'],env);
 }finally{
  if(created){if(!/^staff_auth_test_[a-f0-9]{24}$/.test(schema))throw Error('INVALID_CLEANUP_SCHEMA');await control.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);}
  if(before){const after=await helper.fingerprints(reader,before.columns);if(JSON.stringify(before.tables)!==JSON.stringify(after.tables))throw Error('EXISTING_RECORDS_CHANGED');}
  await Promise.all([reader.$disconnect(),control.$disconnect()]);
  if(JSON.stringify(baseline)!==JSON.stringify(hashes()))throw Error('PROTECTED_CONFIGURATION_CHANGED');
 }
 console.log(JSON.stringify({isolatedSchemaDisposed:true,publicRecordsUnchanged:true,configurationUnchanged:true,productionAccessed:false}));
 fs.mkdirSync('docs/auth-security',{recursive:true});
 fs.writeFileSync('docs/auth-security/preservation.json',JSON.stringify({capturedAt:new Date().toISOString(),isolatedSchemaDisposed:true,publicRecordsUnchanged:true,configurationUnchanged:true,productionAccessed:false,publicMigrationApplied:false},null,2)+'\n');
}
main().catch(e=>{console.error(JSON.stringify({code:e.code||e.name,message:/^[A-Z_]+$/.test(e.message)?e.message:undefined,diagnostics:e.safeDiagnostics}));process.exitCode=1;});

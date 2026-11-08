/* eslint-disable @typescript-eslint/no-require-imports -- Guarded isolated-schema verification. Never uses the production database. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {randomBytes}=require('node:crypto'),{spawn,execFileSync}=require('node:child_process'),{parseEnv}=require('node:util');
const {PrismaClient}=require('@prisma/client'),helper=require('./batch0-recovery-environment.cjs');
const config=helper.configuration(),directory='docs/employee-registration/verification';fs.mkdirSync(directory,{recursive:true});
assert.equal(config.identity.branchId,'br-damp-fog-azmmxhga');assert.equal(config.identity.endpointId,'ep-wild-mud-az8yzifu');assert(config.identity.distinctFromProtectedOriginal);
const reuse=process.argv.includes('--existing'),saved=reuse?parseEnv(fs.readFileSync('.env.employee-registration-test.local','utf8')):null;
const schema=saved?new URL(saved.DATABASE_URL).searchParams.get('schema'):'batch3_test_'+randomBytes(12).toString('hex');assert.match(schema,/^batch3_test_[a-f0-9]{24}$/);
const url=new URL(saved?.DATABASE_URL??config.direct);url.searchParams.set('schema',schema);url.searchParams.set('options',`-c search_path=${schema},public`);url.searchParams.set('connection_limit','8');assert.equal(url.hostname.split('.')[0],config.identity.endpointId);
const env={...config.environment,...saved,DATABASE_URL:url.href,H10_TEST_DATABASE_URL:url.href,NODE_ENV:'test',VERCEL_ENV:'',VERCEL:'0',SESSION_SECRET:saved?.SESSION_SECRET??randomBytes(40).toString('hex'),PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK:'1',NODE_OPTIONS:''};
const results=[];const redact=s=>s.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]').replaceAll(env.SESSION_SECRET,'[REDACTED]');
async function run(name,args,extra={}){const started=Date.now();const child=spawn(process.execPath,args,{env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;fs.writeFileSync(`${directory}/${name}.log`,redact(output));});const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});fs.writeFileSync(`${directory}/${name}.log`,redact(output));const result={name,exitCode,elapsedMs:Date.now()-started};results.push(result);console.log(JSON.stringify(result));return result;}
async function main(){const control=new PrismaClient({datasources:{db:{url:helper.readOnly(config.direct)}},log:[]}),db=new PrismaClient({datasources:{db:{url:url.href}},log:[]});
 try{
  const [identity]=await control.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint`;assert.equal(identity.branch,config.identity.branchId);assert.equal(identity.endpoint,config.identity.endpointId);
  if(!reuse){const writer=new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});try{await writer.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);}finally{await writer.$disconnect();}}
  assert.equal((await db.$queryRaw`SELECT current_schema() AS schema`)[0].schema,schema);
  assert.equal((await run('01-migrations',['node_modules/prisma/build/index.js','migrate','deploy'])).exitCode,0);
  const history=await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished FROM "_prisma_migrations" ORDER BY migration_name`;
  const columns=await db.$queryRaw`SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema=${schema} AND table_name='Employee' AND column_name IN ('sourceApplicationId','applicantId','registrationKey') ORDER BY column_name`;
  fs.writeFileSync(`${directory}/migration-readiness.json`,JSON.stringify({schema,branch:identity.branch,productionAccessed:false,migrations:history.length,allFinished:history.every(row=>row.finished),employeeSourceColumns:columns,history},null,2));
  if(process.argv.includes('--migration-only'))return;
  fs.writeFileSync('.env.employee-registration-test.local',Object.entries(env).filter(([key])=>['DATABASE_URL','H10_TEST_DATABASE_URL','SESSION_SECRET','PLATFORM_ROOT_DOMAIN','PLATFORM_PUBLIC_ORIGIN'].includes(key)).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n'));
  if(!process.argv.includes('--checks-only'))await run('02-registration-and-roles',['scripts/test-employee-registration.cjs']);
  if(process.argv.includes('--test-only')) {
    assert.equal(results.find(row=>row.name==='02-registration-and-roles').exitCode,0,'Registration/role checks failed.');
    return;
  }
  const preload='--require '+path.resolve('scripts/subscription-test-preload.cjs');
  await run('role-payslip-access',['node_modules/tsx/dist/cli.mjs','scripts/test-employee-role-payslips.ts'],{NODE_OPTIONS:preload});
  if(!process.argv.includes('--focused')){
   for(const script of ['test-h4-employee-self-service.ts','test-h5-leave-management.ts','test-h3-attendance.ts','test-rfid-attendance.ts','test-s1-saas-shell.ts','test-hiring-policy.cjs'])await run('regression-'+script.replace(/\.(ts|cjs)$/,''),['node_modules/tsx/dist/cli.mjs','scripts/'+script],{NODE_OPTIONS:preload});
   await run('regression-payroll',['node_modules/tsx/dist/cli.mjs','scripts/test-employee-workforce-regressions.ts'],{NODE_OPTIONS:preload});
  }
  await run('03-typescript',['node_modules/typescript/bin/tsc','--noEmit']);await run('04-prisma-validation',['node_modules/prisma/build/index.js','validate']);
  const tracked=execFileSync('git',['diff','--name-only','33b99ad'],{encoding:'utf8'}).trim().split(/\r?\n/);
  const added=execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p.startsWith('src/')||/^scripts\/(?:test-employee|verify-employee)/.test(p));
  const files=[...new Set([...tracked,...added])].filter(file=>/\.(ts|tsx|cjs)$/.test(file)&&fs.existsSync(file));
  await run('05-changed-eslint',['node_modules/eslint/bin/eslint.js',...files]);
  if(!process.argv.includes('--focused'))await run('06-full-eslint',['node_modules/eslint/bin/eslint.js','.']);
  await run('07-production-build',['node_modules/next/dist/bin/next','build','--webpack'],{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'});
  await run('08-schema-diff',['node_modules/prisma/build/index.js','migrate','diff','--from-url',url.href,'--to-schema-datamodel','prisma/schema.prisma','--exit-code']);
  helper.assertOriginalUnchanged(config);
 }finally{await db.$disconnect();await control.$disconnect();fs.writeFileSync(`${directory}/${process.argv.includes('--migration-only')?'migration-results':process.argv.includes('--test-only')?'registration-results':reuse?'final-results':'results'}.json`,JSON.stringify({schema,branch:config.identity.branchId,productionAccessed:false,originalEnvUnchanged:true,results},null,2));}
 const failed=results.filter(x=>x.exitCode!==0&&!['06-full-eslint','08-schema-diff'].includes(x.name));assert.equal(failed.length,0,'Required checks failed: '+failed.map(x=>x.name).join(', '));
}
main().catch(error=>{console.error('EMPLOYEE_VERIFICATION_FAILURE',error.code||error.name,redact(String(error.message)));process.exitCode=1;});

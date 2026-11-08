/* eslint-disable @typescript-eslint/no-require-imports -- Local verification using existing disposable schemas and strict database identity checks. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn,execFileSync}=require('node:child_process'),{parseEnv}=require('node:util');
const {PrismaClient}=require('@prisma/client'),helper=require('./batch0-recovery-environment.cjs');
const {randomBytes}=require('node:crypto');
const directory='docs/final-plan-release/verification';fs.mkdirSync(directory,{recursive:true});
const config=helper.configuration();
assert.equal(config.identity.branchId,'br-damp-fog-azmmxhga');assert.equal(config.identity.endpointId,'ep-wild-mud-az8yzifu');
const results=[];
const protectedFiles=execFileSync('git',['ls-files','--modified','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>/^(?:docs\/payroll|scripts\/(?:payroll-v[23]|test-payroll-v3))/.test(p));
const preserved=Object.fromEntries(protectedFiles.filter(p=>fs.statSync(p).isFile()).map(p=>[p,helper.digest(fs.readFileSync(p))]));
const redact=s=>s.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]');
async function run(name,args,env){
 const started=Date.now(),child=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b;fs.writeFileSync(`${directory}/${name}.log`,redact(output));});
 const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
 fs.writeFileSync(`${directory}/${name}.log`,redact(output));
 results.push({name,exitCode,elapsedMs:Date.now()-started});console.log(JSON.stringify(results.at(-1)));
}
async function profile(file,prefix){
 const saved=parseEnv(fs.readFileSync(file,'utf8')),url=new URL(saved.DATABASE_URL),schema=url.searchParams.get('schema');
 assert.match(schema,new RegExp('^'+prefix+'[a-f0-9]{24}$'));assert.equal(url.hostname.replace('-pooler.','.').split('.')[0],config.identity.endpointId);
 url.searchParams.set('options',`-c search_path=${schema},public`);url.searchParams.set('connection_limit','8');
 const db=new PrismaClient({datasources:{db:{url:helper.readOnly(url)}},log:[]});
 try{
  const [identity]=await db.$queryRaw`SELECT current_schema() AS schema,current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint,current_setting('transaction_read_only') AS read_only`;
  assert.equal(identity.schema,schema);assert.equal(identity.branch,config.identity.branchId);assert.equal(identity.endpoint,config.identity.endpointId);assert.equal(identity.read_only,'on');
  const [{count}]=await db.$queryRaw`SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  console.log(JSON.stringify({schema,migrations:count,productionAccessed:false}));
 }finally{await db.$disconnect();}
 return {...config.environment,...saved,DATABASE_URL:url.href,H10_TEST_DATABASE_URL:url.href,NODE_ENV:'test',VERCEL_ENV:'',VERCEL:'0',NODE_OPTIONS:'--require '+JSON.stringify(path.resolve('scripts/final-plan-test-preload.cjs'))};
}
async function cleanAttendance(employee){
  // H3 asserts a schema-wide event count of one, so reused fixtures invalidate
  // its assertion. Give this unchanged suite its own empty disposable schema.
  const schema='batch3_test_'+randomBytes(12).toString('hex');
  const control=new PrismaClient({datasources:{db:{url:employee.DATABASE_URL}},log:[]});
  try{await control.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);}finally{await control.$disconnect();}
  const url=new URL(employee.DATABASE_URL);url.searchParams.set('schema',schema);url.searchParams.set('options',`-c search_path=${schema},public`);
  const isolated={...employee,DATABASE_URL:url.href,H10_TEST_DATABASE_URL:url.href};
  await run('attendance-clean-migrations',['node_modules/prisma/build/index.js','migrate','deploy'],isolated);
  assert.equal(results.at(-1).exitCode,0,'Clean attendance schema migrations failed');
  const db=new PrismaClient({datasources:{db:{url:helper.readOnly(url)}},log:[]});
  try{assert.equal((await db.$queryRaw`SELECT current_schema() AS schema`)[0].schema,schema);assert.equal(await db.attendanceEvent.count(),0);}finally{await db.$disconnect();}
  await run('attendance-clean-regression',['node_modules/tsx/dist/cli.mjs','scripts/test-h3-attendance.ts'],isolated);
}
async function main(){
 const employee=await profile('.env.employee-registration-test.local','batch3_test_');
 const subscriptions=await profile('.env.subscriptions-test.local','subscription_test_');
 if(process.argv.includes('--attendance-clean')){await cleanAttendance(employee);return;}
 if(process.argv.includes('--subscription-migrations')){
   // Only this runner-owned schema, on the verified nonproduction endpoint.
   await run('subscription-schema-migrations',['node_modules/prisma/build/index.js','migrate','deploy'],subscriptions);return;
 }
 if(process.argv.includes('--checks')){
  await run('typescript',['node_modules/typescript/bin/tsc','--noEmit'],employee);
  await run('prisma-validation',['node_modules/prisma/build/index.js','validate'],employee);
  const files=[...new Set([...execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split(/\r?\n/),...execFileSync('git',['ls-files','--others','--exclude-standard'],{encoding:'utf8'}).trim().split(/\r?\n/)])].filter(p=>/\.(ts|tsx|cjs)$/.test(p)&&!protectedFiles.includes(p));
  await run('changed-eslint',['node_modules/eslint/bin/eslint.js',...files],employee);
  await run('production-build',['node_modules/next/dist/bin/next','build','--webpack'],{...employee,NODE_ENV:'production',NODE_OPTIONS:'',NEXT_TELEMETRY_DISABLED:'1'});return;
 }
 await run('final-plan-enforcement',['scripts/test-final-plans.cjs'],employee);
 if(process.argv.includes('--policy-only'))return;
 await run('subscription-engine',['scripts/test-subscriptions.cjs'],subscriptions);
 await run('subscription-domain',['node_modules/tsx/dist/cli.mjs','scripts/test-subscription-domain.ts'],employee);
 if(!process.argv.includes('--focused')){
  await run('employee-registration',['scripts/test-employee-registration.cjs'],employee);
  for(const name of ['test-employee-role-payslips','test-h4-employee-self-service','test-h5-leave-management','test-rfid-attendance','test-h8-analytics','test-s1-saas-shell','test-employee-workforce-regressions'])await run(name,['node_modules/tsx/dist/cli.mjs',`scripts/${name}.ts`],employee);
  await cleanAttendance(employee);
  await run('hiring-policy',['scripts/test-hiring-policy.cjs'],employee);
 }
}
main().catch(error=>{console.error('FINAL_PLAN_VERIFICATION_FAILURE',redact(String(error.message)));process.exitCode=1;}).finally(()=>{
 helper.assertOriginalUnchanged(config);
 for(const [file,hash] of Object.entries(preserved))assert.equal(helper.digest(fs.readFileSync(file)),hash,'Payroll recovery changed: '+file);
 fs.writeFileSync(`${directory}/${process.argv.includes('--checks')?'checks':process.argv.includes('--attendance-clean')?'attendance-clean-results':process.argv.includes('--policy-only')?'policy-results':process.argv.includes('--focused')?'focused-results':process.argv.includes('--subscription-migrations')?'test-schema-migrations':'test-results'}.json`,JSON.stringify({productionAccessed:false,branch:config.identity.branchId,payrollRecoveryPreserved:true,results},null,2));
 if(results.some(r=>r.exitCode!==0))process.exitCode=1;
});

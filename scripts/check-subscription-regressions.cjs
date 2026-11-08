/* eslint-disable @typescript-eslint/no-require-imports -- Additional existing regression entrypoints, always scoped to owned non-production schemas. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util'),{spawn}=require('node:child_process'),{randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const profile=parseEnv(fs.readFileSync('.env.subscriptions-test.local','utf8'));
const source=new URL(profile.DATABASE_URL),directory='docs/subscriptions/verification',results=[];
assert.match(source.searchParams.get('schema')||'',/^subscription_test_[a-f0-9]{24}$/);
assert.equal(source.hostname.split('.')[0],'ep-wild-mud-az8yzifu');
async function run(name,args,url=source){
  const child=spawn(process.execPath,args,{env:{...process.env,...profile,DATABASE_URL:url.href,H10_TEST_DATABASE_URL:url.href,NODE_ENV:'test',NODE_OPTIONS:'--require '+path.resolve('scripts/subscription-test-preload.cjs'),VERCEL:'0',VERCEL_ENV:'',PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>output+=b);
  const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  fs.writeFileSync(`${directory}/${name}.log`,output.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));
  const result={name,exitCode};results.push(result);console.log(JSON.stringify(result));return result;
}
async function main(){
  const db=new PrismaClient({datasources:{db:{url:source.href}},log:[]});
  const schema='batch3_test_'+randomBytes(12).toString('hex');assert.match(schema,/^batch3_test_[a-f0-9]{24}$/);
  const url=new URL(source);url.searchParams.set('schema',schema);url.searchParams.set('options',`-c search_path=${schema},public`);
  try {
    const [identity]=await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch`;assert.equal(identity.branch,'br-damp-fog-azmmxhga');
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    assert.equal((await run('rfid-owned-migrations',['node_modules/prisma/build/index.js','migrate','deploy'],url)).exitCode,0);
    await run('rfid-owned-regression',['node_modules/tsx/dist/cli.mjs','scripts/test-rfid-attendance.ts'],url);
    await run('payroll-current-regressions',['node_modules/tsx/dist/cli.mjs','scripts/test-subscription-workforce-regressions.ts']);
  } finally {
    // Only this invocation's generated fixture schema is eligible for disposal.
    assert.match(schema,/^batch3_test_[a-f0-9]{24}$/);
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();fs.writeFileSync(`${directory}/additional-regressions.json`,JSON.stringify(results,null,2));
  }
  assert(results.every(result=>result.exitCode===0),'Some additional regressions failed; see logs.');
}
main().catch(error=>{console.error('ADDITIONAL_REGRESSION_FAILURE',error.code||error.name,error.message);process.exitCode=1;});

/* eslint-disable @typescript-eslint/no-require-imports -- This diagnostic runner executes directly in Node's CommonJS runtime. */
// Testing-branch-only benchmarks and isolated regression runner. Never logs credentials/rows.
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {PrismaClient}=require('@prisma/client');
const {hash}=require('bcryptjs');
const helper=require('./batch0-recovery-environment.cjs');
const browser=require('./batch0-recovery-browser.cjs');
const config=helper.configuration();
const prior=JSON.parse(fs.readFileSync(path.join(helper.directory,'schema-and-history-verification.json')));
if(prior.identity.endpointSha256!==config.identity.endpointSha256||!prior.h10Applied)helper.fail('UNVERIFIED_TARGET');
const directory='docs/performance-audit/batch-1';
fs.mkdirSync(directory,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(directory,name+'.json'),JSON.stringify(value,null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const environment={...config.environment,DATABASE_URL:config.direct.href,H10_TEST_DATABASE_URL:config.direct.href,NODE_ENV:'test'};
async function command(name,args,env=environment){
  const started=performance.now(),child=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const exitCode=await new Promise((r,j)=>{child.on('exit',r);child.on('error',j)});
  const result={name,exitCode,elapsedMs:Math.round(performance.now()-started),assertions:output.split(/\r?\n/).filter(l=>/^(PASS \d+:|REGRESSION |INTERFACE PASS|H10\.|H8 |S1 |✓ |✔ )/.test(l)).map(l=>l.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]').replace(/[\w.+-]+@[\w.-]+/g,'[EMAIL]')),errorCodes:[...new Set(output.match(/\b(?:P\d{4}|EPERM|EACCES|ENOENT|TS\d{4})\b/g)||[])]};
  // Compiler/linter diagnostic lines contain source locations, not record values.
  if(exitCode)result.diagnostics=output.split(/\r?\n/).filter(l=>/error TS|warning |error |Error:|FAIL:|AssertionError|\.ts[(:]/.test(l)).slice(-25).map(l=>l.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));
  save(name,result);console.log(JSON.stringify({name,exitCode,elapsedMs:result.elapsedMs,assertions:result.assertions.length,errorCodes:result.errorCodes,diagnostics:result.diagnostics}));return result;
}
async function isolatedReadTests(){
  const schema='batch1_test_'+randomBytes(12).toString('hex');
  if(!/^batch1_test_[a-f0-9]{24}$/.test(schema))helper.fail('INVALID_FIXTURE_SCHEMA');
  const control=new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});let created=false;
  const url=new URL(config.direct);url.searchParams.set('schema',schema);url.searchParams.set('options','-c search_path='+schema+',public');
  const env={...environment,DATABASE_URL:url.href,H10_TEST_DATABASE_URL:url.href,NODE_OPTIONS:'--require '+path.resolve('scripts/performance-audit-preload.cjs')};
  try{
    await control.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');created=true;
    if((await command('analytics-fixture-migrations',['node_modules/prisma/build/index.js','migrate','deploy'],env)).exitCode)throw Error('FIXTURE_SETUP_FAILED');
    const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
    if((await command('analytics',[npm,'run','test:h8'],env)).exitCode)throw Error('ANALYTICS_FAILED');
  }finally{
    if(created)await control.$executeRawUnsafe('DROP SCHEMA "'+schema+'" CASCADE');
    await control.$disconnect();helper.assertOriginalUnchanged(config);
  }
}
async function benchmark(label){
  const db=new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});let server,session;const users=[];let account;
  try{
    const org=await db.organization.findUniqueOrThrow({where:{slug:'st-aloysius'},select:{id:true}});
    const employee=await db.employee.findFirst({where:{organizationId:org.id,employeeStatus:'ACTIVE',employeeAccount:null,employmentRecords:{some:{}}},select:{id:true},orderBy:{id:'asc'}});
    if(!employee)helper.fail('NO_UNLINKED_ACTIVE_EMPLOYEE_FOR_TEMP_LOGIN');
    const password=randomBytes(32).toString('hex'),passwordHash=await hash(password,10);
    for(const role of ['ORGANIZATION_ADMIN','EMPLOYEE'])users.push(await db.user.create({data:{organizationId:org.id,email:'batch1-'+randomBytes(12).toString('hex')+'@audit.invalid',name:'Performance Test',role,passwordHash},select:{id:true,email:true}}));
    account=await db.employeeAccount.create({data:{organizationId:org.id,userId:users[1].id,employeeId:employee.id,createdById:users[0].id,status:'ACTIVE',activatedAt:new Date()},select:{id:true}});
    const port=3101,env={...config.environment,NODE_ENV:'production',DATABASE_URL:helper.readOnly(config.pooled),PLATFORM_ROOT_DOMAIN:'localhost:'+port,PLATFORM_PUBLIC_ORIGIN:'http://localhost:'+port};
    let log='';server=spawn(process.execPath,['--require','./scripts/performance-audit-preload.cjs','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
    for(const s of [server.stdout,server.stderr])s.on('data',b=>log+=b);
    for(let i=0;i<600&&!log.includes('Ready in')&&server.exitCode===null;i++)await pause(100);
    if(!log.includes('Ready in'))helper.fail('SERVER_NOT_READY');
    const results=[];
    for(const [user,employeeLogin,routes]of [[users[0],false,[['Dashboard','/dashboard',['Welcome Back,','New Hires']],['Analytics','/dashboard/analytics',['Workforce Overview','Attendance','Payroll']]]],[users[1],true,[['ESS','/employee',['My Dashboard','Latest finalized payroll','Pending requests:']]]]]){
      session=await browser({port,production:true,email:user.email,password,employeeLogin});const cookie=session.cookie;await session.close();session=null;await pause(1000);
      for(const [name,route,expected]of routes)for(let iteration=0;iteration<6;iteration++){
        const start=performance.now(),logStart=log.length;
        const response=await fetch('http://127.0.0.1:'+port+route,{headers:{host:'saga.localhost:'+port,'x-forwarded-host':'saga.localhost:'+port,cookie},redirect:'manual',signal:AbortSignal.timeout(90000)});
        const ttfbMs=performance.now()-start,body=await response.text(),completionMs=performance.now()-start;await pause(300);
        const segment=log.slice(logStart),queries=[...segment.matchAll(/\[Audit query\] (\{[^\r\n]+\})/g)].map(m=>JSON.parse(m[1]));
        const row={route:name,iteration,ttfbMs,completionMs,sqlStatements:queries.length,queries,status:response.status,expectedContent:expected.every(t=>body.includes(t)),streamedError:/data-dgst=|:E\{|\\?"digest\\?"\s*:|Something went wrong while loading this page/.test(body),runtimeCodes:[...new Set(segment.match(/\bP\d{4}\b/g)||[])]};results.push(row);save(label+'-http',results);
        console.log(JSON.stringify({label,route:name,iteration,completionMs:Math.round(completionMs),sqlStatements:row.sqlStatements,valid:row.expectedContent&&!row.streamedError}));
        if(row.status!==200||!row.expectedContent||row.streamedError||row.runtimeCodes.length)helper.fail('PAGE_VERIFICATION_FAILED');
      }
    }
    save(label+'-conditions',{identity:config.identity,normalPasswordLogin:true,temporaryUsers:2,temporaryAccount:1,samplesPerRoute:6,warmSamples:5,readOnlyPageRequests:true,mode:'local production webpack',coldStart:false});
  }finally{
    await session?.close();server?.kill();
    if(account)await db.employeeAccount.delete({where:{id:account.id}});
    for(const user of users.reverse())await db.user.delete({where:{id:user.id}});
    await db.$disconnect();helper.assertOriginalUnchanged(config);
  }
}
async function main(){
  const mode=process.argv[2];
  if(mode==='before'||mode==='after')return benchmark(mode);
  if(mode==='test-analytics')return isolatedReadTests();
  if(mode==='test-interface'){
    const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
    const env={...environment,NODE_OPTIONS:'--require '+path.resolve('scripts/performance-audit-preload.cjs')};
    if((await command('h10-interface',[npm,'run','test:h10-interface'],env)).exitCode)throw Error('INTERFACE_FAILED');
    return;
  }
  if(mode==='test-ess'){
    const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
    const env={...environment,NODE_OPTIONS:'--require '+path.resolve('scripts/performance-audit-preload.cjs')};
    if((await command('ess-retry',[npm,'run','test:h10-2','--','--regression=test:h4'],env)).exitCode)throw Error('ESS_FAILED');
    return;
  }
  if(mode==='build'){
    const env={...environment,NODE_ENV:'production',DATABASE_URL:helper.readOnly(config.pooled)};
    for(const [name,args]of [['typescript',['node_modules/typescript/bin/tsc','--noEmit']],['production-build',['node_modules/next/dist/bin/next','build','--webpack']]])if((await command(name,args,env)).exitCode)throw Error('BUILD_FAILED');
  }else if(mode==='tests'){
    const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
    const env={...environment,NODE_OPTIONS:'--require '+path.resolve('scripts/performance-audit-preload.cjs')};
    const suites=[['h10-1','test:h10-1'],['h10-2','test:h10-2'],['isolated-regressions','test:h10-2','--','--regressions-only'],['h10-interface','test:h10-interface']];
    let failed=false;for(const [name,...args]of suites)if((await command(name,[npm,'run',...args],env)).exitCode)failed=true;
    try{await isolatedReadTests()}catch{failed=true}
    if(failed)throw Error('REGRESSIONS_FAILED');
  }else throw Error('UNKNOWN_MODE');
}
main().catch(e=>{console.error(JSON.stringify({code:e.code||e.name,message:/^[A-Z_]+$/.test(e.message)?e.message:undefined}));process.exitCode=1});

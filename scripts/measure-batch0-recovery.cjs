// Recovery baseline: genuine password authentication; no tokens or row bodies recorded.
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {stripVTControlCharacters}=require('node:util');
const {PrismaClient}=require('@prisma/client');
const {hash}=require('bcryptjs');
const helper=require('./batch0-recovery-environment.cjs');
const browser=require('./batch0-recovery-browser.cjs');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const config=helper.configuration(),mode=process.argv[2]||'prod';
if(!['prod','dev'].includes(mode))helper.fail('UNKNOWN_BASELINE_MODE');
const verification=JSON.parse(fs.readFileSync(path.join(helper.directory,'schema-and-history-verification.json')));
if(verification.identity.endpointSha256!==config.identity.endpointSha256||!verification.h10Applied||verification.changedProtectedTables.length)helper.fail('RECOVERY_NOT_VERIFIED');
const db=new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});
function bodyState(body,expected){return {expectedContent:expected.every(t=>body.includes(t)),streamedError:/data-dgst=|:E\{|\\?"digest\\?"\s*:|Something went wrong while loading this page/.test(body)};}
async function main(){
  let account=null,server=null,session=null;
  const production=mode==='prod',port=production?3101:3100;
  try{
    const org=await db.organization.findUnique({where:{slug:'st-aloysius'},select:{id:true}});if(!org)helper.fail('SAGA_CLONE_NOT_FOUND');
    const employee=await db.employee.findFirst({where:{organizationId:org.id,employmentRecords:{some:{}}},select:{id:true,employeeNumber:true},orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}]});if(!employee)helper.fail('EMPLOYEE_PROFILE_FIXTURE_UNAVAILABLE');
    let email=config.profile.WORKPULSE_RECOVERY_LOGIN_EMAIL,password=config.profile.WORKPULSE_RECOVERY_LOGIN_PASSWORD;
    if(!email||!password){
      email='batch0-'+randomBytes(10).toString('hex')+'@audit.invalid';password=randomBytes(32).toString('hex');
      account=await db.user.create({data:{organizationId:org.id,email,passwordHash:await hash(password,10),name:'Recovery Audit',role:'ORGANIZATION_ADMIN'},select:{id:true}});
    }
    const routes=[
      {name:'Dashboard',route:'/dashboard',expected:['Welcome Back,','New Hires','Pending Actions'],sidebar:true},
      {name:'Employee Records',route:'/dashboard/employees',expected:['Employee Records','Manage employee information'],sidebar:true},
      {name:'Employee Profile',route:'/dashboard/employees/'+employee.id,expected:[employee.employeeNumber,'Back to Employee Records','Employment History'],sidebar:false},
      {name:'Exit Management',route:'/dashboard/employees/exit',expected:['Create exit case','Separation cases'],sidebar:true},
    ];
    const environment={...config.environment,NODE_ENV:production?'production':'development',DATABASE_URL:helper.readOnly(config.pooled),PLATFORM_ROOT_DOMAIN:'localhost:'+port,PLATFORM_PUBLIC_ORIGIN:'http://localhost:'+port};
    const args=['--require','./scripts/performance-audit-preload.cjs','node_modules/next/dist/bin/next',production?'start':'dev',...(production?[]:['--webpack']),'-H','127.0.0.1','-p',String(port)];
    server=spawn(process.execPath,args,{env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';
    for(const stream of [server.stdout,server.stderr])stream.on('data',b=>log+=b.toString());
    for(let i=0;i<900&&!log.includes('Ready in')&&server.exitCode===null;i++)await pause(100);
    if(!log.includes('Ready in'))helper.fail('BASELINE_SERVER_NOT_READY');
    session=await browser({port,production,email,password});
    const cookie=session.cookie;await session.close();session=null;await pause(1000);
    helper.save(mode+'-authentication',{method:'Normal login form, bcrypt validation, persisted tenant/role guard and server-issued cookie',temporaryAccount:!!account,credentialsAndCookiesSaved:false,dashboardVisitedDuringLogin:true});
    const navigationOnly=process.argv.includes('--navigation-only');
    const results=navigationOnly?JSON.parse(fs.readFileSync(path.join(helper.directory,mode+'-successful-pages.json'))):[];
    if(!navigationOnly)for(const route of routes)for(let iteration=0;iteration<4;iteration++){
      const start=performance.now(),logStart=log.length;
      const response=await fetch('http://127.0.0.1:'+port+route.route,{headers:{host:'saga.localhost:'+port,'x-forwarded-host':'saga.localhost:'+port,cookie},redirect:'manual',signal:AbortSignal.timeout(90000)});
      const ttfb=performance.now()-start,body=await response.text(),complete=performance.now()-start;await pause(300);
      const segment=stripVTControlCharacters(log.slice(logStart));
      const queries=[...segment.matchAll(/\[Audit query\] (\{[^\r\n]+\})/g)].map(m=>JSON.parse(m[1]));
      const state=bodyState(body,route.expected);
      const result={route:route.name,iteration,httpStatus:response.status,initialTtfbMs:Math.round(ttfb*10)/10,completionMs:Math.round(complete*10)/10,sqlStatements:queries.length,databaseDurationSumMs:queries.reduce((s,q)=>s+q.ms,0),queryMetrics:queries,responseBytes:Buffer.byteLength(body),...state,runtimeErrorCodes:[...new Set(segment.match(/\bP\d{4}\b/g)||[])]};
      results.push(result);helper.save(mode+'-successful-pages',results);console.log(JSON.stringify({mode,route:route.name,iteration,ms:result.completionMs,sql:result.sqlStatements,content:state.expectedContent,error:state.streamedError}));
      if(response.status!==200||!state.expectedContent||state.streamedError||result.runtimeErrorCodes.length)helper.fail('RENDERED_PAGE_CHECK_FAILED');
    }
    session=await browser({port,production,email,password});const navigation=[];
    for(let cycle=0;cycle<3;cycle++)for(const route of [routes[1],routes[2],routes[3],routes[0]]){
      const row={cycle,...await session.navigate(route)};navigation.push(row);helper.save(mode+'-navigation',navigation);console.log(JSON.stringify({mode,route:row.route,cycle,navigationMs:row.navigationMs,completed:row.completed}));
      if(!row.completed||!row.expectedContent||row.renderedError)helper.fail('BROWSER_RENDER_CHECK_FAILED');
    }
    helper.save(mode+'-runtime',{normalAuthentication:true,httpSamples:results.length,browserSamples:navigation.length,runtimeErrorCodes:[...new Set(log.match(/\bP\d{4}\b/g)||[])],databaseReadOnlyDuringPageRequests:true,firstRequestsNotProvenColdStarts:true});
  }finally{
    await session?.close();server?.kill();
    if(account)await db.user.delete({where:{id:account.id}});
    await db.$disconnect();helper.assertOriginalUnchanged(config);
    helper.save(mode+'-cleanup',{temporaryAccountRemoved:!!account,serverStopped:!!server,originalEnvUnchanged:true});
  }
}
main().catch(e=>{helper.save(mode+'-baseline-error',{code:e.code||e.name});console.error(JSON.stringify({code:e.code||e.name}));process.exitCode=1;});

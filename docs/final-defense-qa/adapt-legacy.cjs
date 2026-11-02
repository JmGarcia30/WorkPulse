// Reuse existing suites without changing their files or historical reports.
const fs = require('node:fs'),path=require('node:path'),Module=require('node:module');
const assert=require('node:assert/strict');
const originalLoad=Module._load;
const cp=require('node:child_process'),spawnSync=cp.spawnSync;
cp.spawnSync=function(command,args,options){
  let r;
  for(let attempt=0;attempt<8;attempt++) {
    r=spawnSync(command,args,options);
    if(!args?.includes('deploy')||r.status===0||!String(r.stderr).includes('P1002'))break;
  }return r;
};
const real=require('../../scripts/batch0-recovery-environment.cjs');
const target=new URL(process.env.DATABASE_URL);
assert.match(target.searchParams.get('schema')||'',/^(batch3_test_|staff_auth_test_)[a-f0-9]{24}$/);
const base=real.configuration();
assert.equal(target.hostname.replace('-pooler.','.'),base.direct.hostname);
const write=fs.writeFileSync.bind(fs),mkdir=fs.mkdirSync.bind(fs);
const redirect=p=>typeof p==='string'&&p.replaceAll('\\','/').startsWith('docs/')&&!p.replaceAll('\\','/').startsWith('docs/final-defense-qa/')?path.join(process.env.WORKPULSE_QA_EVIDENCE_DIR||'docs/final-defense-qa/evidence','legacy',p):p;
fs.writeFileSync=(p,...args)=>{p=redirect(p);mkdir(path.dirname(p),{recursive:true});return write(p,...args);};
fs.mkdirSync=(p,...args)=>mkdir(redirect(p),...args);
const schema=target.searchParams.get('schema');
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const helper={...real,configuration:()=>({...base,direct:new URL(process.env.H10_TEST_DATABASE_URL),pooled:target,environment:{...base.environment,...process.env}}),fingerprints:async(db,columns)=>{
  columns=columns||await db.$queryRawUnsafe('SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name<>\'_prisma_migrations\' ORDER BY table_name,ordinal_position',schema);
  const tables=[];
  for(const table of [...new Set(columns.map(c=>c.table_name))]) {
    const selection=columns.filter(c=>c.table_name===table).map(c=>quote(c.column_name)).join(',');
    const rows=await db.$queryRawUnsafe('SELECT count(*)::int AS count,md5(coalesce(string_agg(md5(row_to_json(x)::text),\'\' ORDER BY md5(row_to_json(x)::text)),\'\')) AS fingerprint FROM (SELECT '+selection+' FROM '+quote(schema)+'.'+quote(table)+') x');
    tables.push({table,...rows[0]});
  }return {columns,tables};
}};
Module._load=function(name,parent,main){
  if(name==='./batch0-recovery-environment.cjs')return helper;
  if(name==='./batch0-recovery-browser.cjs'&&process.argv[2]==='test-rfid-browser.cjs') {
    const filename=path.resolve('scripts/batch0-recovery-browser.cjs');
    const source=fs.readFileSync(filename,'utf8').replace("origin='http://'","origin='https://'").replace('production?9231:9230','production?9249:9248').replace("['--headless=new',","['--ignore-certificate-errors','--allow-insecure-localhost','--headless=new',").replace('.next/recovery-browser-','.next/final-defense-qa-recovery-browser-').replace("if(nav.errorText)throw error('LOGIN_NAVIGATION_FAILED');","if(nav.errorText){console.error('QA navigation: '+nav.errorText);throw error('LOGIN_NAVIGATION_FAILED');}").replace('return {cookie,navigate,evaluate,send,close:',"return {cookie,navigate,evaluate,send,cookieBlocks:()=>events.filter(e=>e.method==='Network.responseReceivedExtraInfo').flatMap(e=>e.params.blockedCookies||[]).filter(c=>c.cookieLine?.startsWith('__Host-workpulse_session=')).map(c=>c.blockedReasons),close:");
    const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(source,filename);return loaded.exports;
  }
  if(name==='server-only')return {};
  return originalLoad.call(this,name,parent,main);
};
async function launch() {
  if(process.argv[2]==='test-staff-session-security.cjs')process.env.NODE_ENV='production';
  if(process.argv[2]==='test-rfid-browser.cjs') {process.env.PLATFORM_ROOT_DOMAIN='localhost:3136';process.env.PLATFORM_PUBLIC_ORIGIN='https://localhost:3136';process.env.NODE_ENV='production';}
  if(['test-hiring-postgres.cjs','test-hiring-browser-final.cjs','test-final-pay.cjs','test-ess-resignation.cjs'].includes(process.argv[2])) {
    const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({log:[]});
    try {await db.organization.create({data:{name:'Synthetic SAGA QA fixture',slug:'st-aloysius',timeZone:'Asia/Manila'}});}finally{await db.$disconnect();}
  }
  if(process.argv[2]==='company-registration-browser.cjs') {
    const filename=path.resolve('scripts',process.argv[2]);
    let source=fs.readFileSync(filename,'utf8');
    const anchor="    const tenantCookie = (await send('Network.getAllCookies')).cookies.find";
    assert(source.includes(anchor));
    source=source.replace(anchor,require('./browser-hook.cjs')+'\n'+anchor).replace('.next/company-registration-browser-profile','.next/final-defense-qa-browser-profile');
    const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(source,filename);
  } else if(process.argv[2]==='test-rfid-browser.cjs') {
    const filename=path.resolve('scripts',process.argv[2]);
    let source=fs.readFileSync(filename,'utf8').replace('dev: true','dev: false').replace('production: false','production: true').replace("require('node:http')","require("+JSON.stringify(path.resolve('docs/final-defense-qa/local-https.cjs'))+")").replaceAll('http://','https://').replaceAll("'workpulse_rfid_kiosk'","'__Host-workpulse_rfid_kiosk'").replaceAll("'workpulse_session'","'__Host-workpulse_session'");
    const cookieCheck="ok(kioskCookie?.httpOnly && kioskCookie.sameSite === 'Strict' && !cookieList.some(cookie => cookie.name === '__Host-workpulse_session'), 'kiosk authorization issues an HttpOnly cookie and removes HR authentication');";
    const beforeKiosk="    await evaluate(`[...document.querySelectorAll('main button')].find(button=>button.textContent.includes('Authorize & Open Kiosk')).click();true`);";
    source=source.replace(beforeKiosk,"    const copiedHrCookie = (await send('Network.getAllCookies')).cookies.find(c => c.name === '__Host-workpulse_session');\n"+beforeKiosk);
    assert(source.includes(cookieCheck));
    source=source.replace(cookieCheck,`ok(kioskCookie?.httpOnly && kioskCookie.sameSite === 'Strict', 'kiosk authorization issues its HttpOnly Strict cookie');
      const residual=cookieList.filter(cookie=>cookie.name==='__Host-workpulse_session').map(cookie=>({name:cookie.name,domain:cookie.domain,secure:cookie.secure,httpOnly:cookie.httpOnly}));
      const cookieEvidence={id:'RFID-008-cookie',status:residual.length?'FAIL':'PASS',expected:'No HR session cookie after kiosk authorization',residualCookies:residual,blockedReasons:session.cookieBlocks()};
      require(${JSON.stringify(path.resolve('docs/final-defense-qa/qa-runner.cjs'))}).save('kiosk-cookie',cookieEvidence);console.log(JSON.stringify(cookieEvidence));
      globalThis.__qaCookieFail=residual.length>0;`)
      .replace('main().then(() => process.exit(0))','main().then(() => process.exit(globalThis.__qaCookieFail ? 1 : 0))')
      .replace("console.error('RFID BROWSER FAILURE', error.code || error.message);","console.error('RFID BROWSER FAILURE', error.code || error.message, error.stack);");
    source=source.replace('globalThis.__qaCookieFail=residual.length>0;',`globalThis.__qaCookieFail=residual.length>0;
      const copiedGrant=await db.staffSession.findUnique({where:{tokenHash:require('node:crypto').createHash('sha256').update(copiedHrCookie.value).digest('hex')},select:{userId:true}});
      const deniedResponse=await new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/api/attendance/rfid/kiosk',method:'POST',headers:{host:'saga.localhost:'+port,Origin:origin,Cookie:copiedHrCookie.name+'='+copiedHrCookie.value}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end();});
      ok(!copiedGrant && deniedResponse===403,'copied pre-kiosk HR token is absent server-side and cannot authorize protected HTTP requests');
      require(${JSON.stringify(path.resolve('docs/final-defense-qa/qa-runner.cjs'))}).save('copied-hr-authorization',{status:!copiedGrant&&deniedResponse===403?'PASS':'FAIL',persistedSessionExists:!!copiedGrant,httpStatus:deniedResponse});`);
    if(process.env.WORKPULSE_BATCH1_BROWSER==='1')source=source.replace('    console.log(`RFID browser tests passed:',require('./batch-1/logout-browser.cjs')+'\n    console.log(`RFID browser tests passed:');
    const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));loaded._compile(source,filename);
  } else require(path.resolve('scripts',process.argv[2]));
}
launch().catch(e=>{console.error(e);process.exitCode=1;});

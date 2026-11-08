/* eslint-disable @typescript-eslint/no-require-imports -- Real production build, browser, login and server actions against the owned subscription fixture schema only. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { parseEnv } = require('node:util');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const profile = parseEnv(fs.readFileSync('.env.subscriptions-test.local','utf8'));
const url = new URL(profile.DATABASE_URL);
assert.match(url.searchParams.get('schema') || '',/^subscription_test_[a-f0-9]{24}$/);
assert.equal(url.hostname.split('.')[0],'ep-wild-mud-az8yzifu');
const db = new PrismaClient({datasources:{db:{url:url.href}},log:[]});
const port=3127, debugPort=9245, directory='docs/subscriptions/verification';
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const checks = [];
let server, chrome, ws, next=0, log='', browserEvents=[];
const pending = new Map();
function check(value,label) { assert(value,label); checks.push(label); console.log('PASS',label); }
async function waitFor(expression,label) {
  for(let i=0;i<150;i++) { if(await evaluate(expression)) return; await pause(200); }
  throw Error('BROWSER_WAIT_FAILED:'+label);
}
function send(method,params={}) {
  return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP_TIMEOUT:'+method));},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
}
async function evaluate(expression) {
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails) throw Error('BROWSER_EVALUATION_FAILED');
  return result.result.value;
}
async function navigate(target,expression) {
  await send('Page.navigate',{url:target});
  await waitFor(expression,target.split('?')[0]); await pause(900);
}
async function login(email,password) {
  await evaluate(`(()=>{document.querySelector('input[name=email]').value=${JSON.stringify(email)};const input=document.querySelector('input[name=password]');input.value=${JSON.stringify(password)};input.form.requestSubmit();return true;})()`);
}
async function submit(selector,values) {
  await evaluate(`(()=>{const form=document.querySelector(${JSON.stringify(selector)}).form;for(const [key,value] of Object.entries(${JSON.stringify(values)})){form.elements.namedItem(key).value=value;}form.requestSubmit();return true;})()`);
}
async function screenshot(name) { const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); fs.writeFileSync(`${directory}/${name}.png`,Buffer.from(image.data,'base64')); }
async function main() {
  const [identity]=await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_schema() AS schema`;
  assert.equal(identity.branch,'br-damp-fog-azmmxhga'); assert.equal(identity.schema,url.searchParams.get('schema'));
  const marker=randomBytes(6).toString('hex'),password=randomBytes(18).toString('hex'),passwordHash=await hash(password,12);
  const org=await db.organization.create({data:{name:'Synthetic subscription browser tenant',slug:'subscription-browser-'+marker}});
  const user=await db.user.create({data:{organizationId:org.id,name:'Subscription browser HR',email:marker+'@browser.invalid',role:'HR_ADMIN',passwordHash}});
  const admin=await db.platformAdministrator.create({data:{name:'Subscription browser admin',email:marker+'@platform.invalid',passwordHash}});
  const tenant=`http://${org.slug}.localhost:${port}`,publicOrigin=`http://localhost:${port}`;
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env:{...process.env,...profile,NODE_ENV:'production',VERCEL:'0',VERCEL_ENV:'',PLATFORM_ROOT_DOMAIN:'localhost:'+port,PLATFORM_PUBLIC_ORIGIN:publicOrigin,NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
  let ready=false;
  for(let i=0;i<100;i++){try{const response=await fetch(publicOrigin+'/platform/login');if(response.status===200){ready=true;break;}}catch{}await pause(200);}
  assert(ready,'Local built server starts');
  chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-proxy-server','--no-first-run','--no-default-browser-check','--disable-background-networking',`--remote-debugging-port=${debugPort}`,'--user-data-dir='+path.resolve('.next/subscription-browser-'+marker),'about:blank'],{windowsHide:true,stdio:'ignore'});
  let page;
  for(let i=0;i<80;i++){try{page=(await(await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item=>item.type==='page');if(page)break;}catch{}await pause(100);}
  assert(page,'Headless browser starts');
  ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=({data})=>{const message=JSON.parse(data);if(message.id){const item=pending.get(message.id);if(item){clearTimeout(item.timer);pending.delete(message.id);if(message.error)item.reject(Error('CDP_ERROR'));else item.resolve(message.result);}}else browserEvents.push(message);};
  await send('Page.enable');await send('Network.enable');await send('Runtime.enable');await send('Network.clearBrowserCookies');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await navigate(tenant+'/login',`!!document.querySelector('input[name=password]')`);
  await login(user.email,password);await waitFor(`location.pathname==='/dashboard/organization/setup'&&!!document.querySelector('input[name=displayName]')`,'Tenant login and initial setup');
  await pause(900);
  await submit('input[name=displayName]',{});
  await waitFor(`document.querySelector('main').innerText.includes('Workspace branding updated.')`,'Initial organization setup without subscription');
  check(await db.organizationBranding.count({where:{organizationId:org.id}})===1,'New tenant completes required organization setup without a subscription');
  await navigate(tenant+'/dashboard/subscription',`document.querySelector('h1')?.innerText==='Your WorkPulse Plan'`);
  check(await evaluate(`document.querySelector('main').innerText.includes('No plan assigned')`),'Organization subscription screen renders from database after real login');
  await submit('form input[name=tier][value=PRO]',{});
  await waitFor(`document.querySelector('main').innerText.includes('pending administrator review')`,'Pending request');
  let request=await db.subscriptionRequest.findFirstOrThrow({where:{organizationId:org.id,status:'PENDING'}});
  check(request.planTier==='PRO' && await db.organizationSubscription.count({where:{organizationId:org.id}})===0,'Browser Pro selection creates a pending request and grants no entitlement');
  check(await evaluate(`[...document.querySelectorAll('form input[name=tier]')].every(input=>input.form.querySelector('button').disabled)`),'Pending request disables duplicate plan requests');
  await screenshot('browser-tenant-pending');
  await navigate(publicOrigin+'/platform/login',`!!document.querySelector('input[name=password]')`);
  await login(admin.email,password);await waitFor(`location.pathname==='/platform'&&!!document.querySelector('aside')`,'Platform login');
  const adminPage=publicOrigin+'/platform/subscriptions?organizationId='+encodeURIComponent(org.id);
  await navigate(adminPage,`!!document.querySelector('input[name=requestId]')`);
  await submit('input[name=requestId]',{decision:'APPROVED',durationMonths:'2',reviewNote:'Synthetic browser approval'});
  await waitFor(`document.querySelector('main').innerText.includes('ACTIVE')&&!document.querySelector('input[name=requestId]')`,'Approved subscription');
  const sub=await db.organizationSubscription.findUniqueOrThrow({where:{organizationId:org.id}});
  check(sub.status==='ACTIVE'&&sub.source==='MANUAL'&&await db.subscriptionOrder.count()===0,'Browser admin approval activates selected duration without recording payment');
  await screenshot('browser-platform-approved');
  await navigate(tenant+'/dashboard/subscription',`document.querySelector('main')?.innerText.includes('APPROVED')`);
  check(await evaluate(`document.querySelector('main').innerText.includes('ACTIVE')&&document.querySelector('main').innerText.includes('2 months')`),'Approved plan, duration and expiration appear in tenant workspace');
  await screenshot('browser-tenant-approved');
  await submit('form input[name=tier][value=BASIC]',{});
  await waitFor(`document.querySelector('main').innerText.includes('pending administrator review')`,'Basic pending');
  request=await db.subscriptionRequest.findFirstOrThrow({where:{organizationId:org.id,status:'PENDING'}});
  await navigate(adminPage,`!!document.querySelector('input[name=requestId]')`);
  await submit('input[name=requestId]',{decision:'REJECTED',reviewNote:'Synthetic browser rejection'});
  await waitFor(`!document.querySelector('input[name=requestId]')&&document.querySelector('main')?.innerText.includes('SUBSCRIPTION REQUEST REJECTED')`,'Rejection');
  check((await db.subscriptionRequest.findUniqueOrThrow({where:{id:request.id}})).status==='REJECTED','Browser administrator rejection persists a reviewed request');
  await navigate(tenant+'/dashboard/subscription',`document.querySelector('main')?.innerText.includes('REJECTED')`);
  check(await evaluate(`document.querySelector('main').innerText.includes('Synthetic browser rejection')&&document.querySelector('main').innerText.includes('ACTIVE')`),'Tenant sees rejection reason and retains approved Pro subscription');
  check(browserEvents.filter(item=>item.method==='Runtime.exceptionThrown').length===0,'No uncaught browser runtime errors in the subscription flow');
  fs.writeFileSync(`${directory}/browser.json`,JSON.stringify({passed:true,checks,productionBuild:true,realServerActions:true,productionAccessed:false,schema:identity.schema},null,2));
}
main().catch(async error=>{console.error('SUBSCRIPTION_BROWSER_FAILURE',error.code||error.name,error.message);fs.writeFileSync(`${directory}/browser.json`,JSON.stringify({passed:false,checks,error:error.message},null,2));if(ws)await screenshot('browser-failure').catch(()=>{});process.exitCode=1;}).finally(async()=>{if(ws){await send('Network.clearBrowserCookies').catch(()=>{});ws.close();}chrome?.kill();server?.kill();await db.$disconnect();fs.writeFileSync(`${directory}/browser-server.log`,log.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));});

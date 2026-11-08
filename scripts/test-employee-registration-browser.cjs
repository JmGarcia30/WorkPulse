/* eslint-disable @typescript-eslint/no-require-imports -- Real production build, browser, login and server actions against the owned employee-registration fixture schema only. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { parseEnv } = require('node:util');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { hash } = require('bcryptjs');
require('tsx/cjs');
const { createEmployeeInvitation } = require('../src/features/employee-self-service/activation.ts');
const { PrismaClient } = require('@prisma/client');
const profile = parseEnv(fs.readFileSync('.env.employee-registration-test.local','utf8'));
const url = new URL(profile.DATABASE_URL);
assert.match(url.searchParams.get('schema') || '',/^batch3_test_[a-f0-9]{24}$/);
assert.equal(url.hostname.split('.')[0],'ep-wild-mud-az8yzifu');
const db = new PrismaClient({datasources:{db:{url:url.href}},log:[]});
const port=3137, debugPort=9255, directory='docs/employee-registration/verification';
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
 assert.equal(identity.branch,'br-damp-fog-azmmxhga');assert.equal(identity.schema,url.searchParams.get('schema'));
 const marker=randomBytes(6).toString('hex'),password=randomBytes(18).toString('hex'),passwordHash=await hash(password,12);
 const org=await db.organization.create({data:{name:'Synthetic employee browser tenant',slug:'employee-browser-'+marker}});
 await db.organizationBranding.create({data:{organizationId:org.id,displayName:org.name,primaryColor:'#17324D',accentColor:'#167D77'}});
 const admin=await db.user.create({data:{organizationId:org.id,name:'Employee browser administrator',email:marker+'@admin.invalid',role:'ORGANIZATION_ADMIN',passwordHash}});
 const hr=await db.user.create({data:{organizationId:org.id,name:'Employee browser HR',email:marker+'@hr.invalid',role:'HR_ADMIN',passwordHash}});
 const tenant=`http://${org.slug}.localhost:${port}`,publicOrigin=`http://localhost:${port}`;
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env:{...process.env,...profile,NODE_ENV:'production',VERCEL:'0',VERCEL_ENV:'',PLATFORM_ROOT_DOMAIN:'localhost:'+port,PLATFORM_PUBLIC_ORIGIN:publicOrigin,NEXT_TELEMETRY_DISABLED:'1',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:'',GMAIL_USER:'',GMAIL_APP_PASSWORD:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(publicOrigin+'/platform/login')).status===200){ready=true;break;}}catch{}await pause(200);}assert(ready,'Local production build starts');
 chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-proxy-server','--no-first-run','--no-default-browser-check','--disable-background-networking',`--remote-debugging-port=${debugPort}`,'--user-data-dir='+path.resolve('.next/employee-browser-'+marker),'about:blank'],{windowsHide:true,stdio:'ignore'});
 let page;for(let i=0;i<80;i++){try{page=(await(await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item=>item.type==='page');if(page)break;}catch{}await pause(100);}assert(page,'Headless browser starts');
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const item=pending.get(m.id);if(item){clearTimeout(item.timer);pending.delete(m.id);if(m.error)item.reject(Error('CDP_ERROR'));else item.resolve(m.result);}}else browserEvents.push(m);};
 await send('Page.enable');await send('Network.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
 async function signIn(user){await send('Network.clearBrowserCookies');await navigate(tenant+'/login',`!!document.querySelector('input[name=password]')`);await login(user.email,password);await waitFor(`!!document.querySelector('aside')&&!document.querySelector('input[name=password]')`,'Normal login');await pause(1200);}
 await signIn(hr);await navigate(tenant+'/dashboard/employees',`!![...document.querySelectorAll('a')].find(a=>a.innerText==='Add Employee')`);
 check(true,'Employee Management exposes Add Employee to authorized HR');
 await navigate(tenant+'/dashboard/employees/new',`!!document.querySelector('input[name=firstName]')`);
 check(await evaluate(`[...document.querySelector('select[name=role]').options].every(option=>option.value==='EMPLOYEE')`),'Regular HR registration form offers Employee role only');
 const email=marker+'@employee.invalid';
 await evaluate(`document.querySelector('input[name=sendInvitation]').checked=false`);
 await submit('input[name=firstName]',{firstName:'Browser',lastName:'Registered Employee',employeeNumber:'BROWSER-'+marker,phone:'09170000000',department:'Operations',jobTitle:'Department Coordinator',email,startDate:'2025-06-01',salary:'35000',employmentType:'Full-time',registrationReason:'Synthetic browser registration'});
 await waitFor(`document.querySelector('main')?.innerText.includes('Employee and linked account registered.')`,'Registration saved');
 const employee=await db.employee.findFirstOrThrow({where:{organizationId:org.id,email},include:{employeeAccount:{include:{user:true}},employmentRecords:true}});
 check(employee.sourceApplicationId===null&&employee.applicantId===null&&employee.employeeAccount.status==='INVITED','Browser registration atomically saves employee/employment/account without recruitment');
 await screenshot('browser-registration-saved');
 await navigate(tenant+'/dashboard/employees/'+employee.id+'?tab=account',`document.querySelector('main')?.innerText.includes('Employee self-service account')`);
 check(!(await evaluate(`document.querySelector('main')?.innerText.includes('Save access role')`)),'Regular HR cannot access the management-role editor');
 const invitation=createEmployeeInvitation();await db.employeeAccount.update({where:{id:employee.employeeAccount.id},data:{activationTokenHash:invitation.hash,activationTokenExpiresAt:invitation.expiresAt}});
 await send('Network.clearBrowserCookies');
 await navigate(tenant+'/activate/employee#token='+encodeURIComponent(invitation.token),`document.querySelectorAll('input[type=password]').length===2`);
 await evaluate(`(()=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const input of document.querySelectorAll('input[type=password]')){setter.call(input,${JSON.stringify(password)});input.dispatchEvent(new Event('input',{bubbles:true}));}return true;})()`);await pause(200);
 await evaluate(`document.querySelector('input[type=password]').form.requestSubmit()`);
 await waitFor(`location.pathname==='/login'&&!!document.querySelector('input[name=password]')`,'Employee activation');
 check((await db.employeeAccount.findUniqueOrThrow({where:{id:employee.employeeAccount.id}})).status==='ACTIVE','Real activation page activates the test-issued invitation without a second authentication system');
 await signIn({email});await waitFor(`location.pathname==='/employee'`,'ESS landing');
 check(await evaluate(`document.querySelector('main')?.innerText.includes('Welcome back, Browser Registered Employee.')`),'Activated Employee signs in to personal ESS');
 await signIn(admin);await navigate(tenant+'/dashboard/employees/'+employee.id+'?tab=account',`!!document.querySelector('select[name=role]')`);
 await evaluate(`document.querySelector('input[name=confirmed]').checked=true`);
 await submit('select[name=role]',{role:'HR_ADMIN',reason:'Synthetic browser HR assignment'});
 await waitFor(`document.querySelector('main')?.innerText.includes('Access role changed.')`,'Role changed');
 check((await db.user.findUniqueOrThrow({where:{id:employee.employeeAccount.userId}})).role==='HR_ADMIN','Organization Administrator changes access role through the actual account tab');
 await screenshot('browser-role-assignment');
 await signIn({email});await waitFor(`!![...document.querySelectorAll('a')].find(a=>a.innerText==='My Employee Self-Service')`,'Linked HR navigation');
 check(await evaluate(`!!document.querySelector('aside')&&location.pathname==='/dashboard'`),'Promoted HR account retains the HR workspace');
 await navigate(tenant+'/employee',`document.querySelector('main')?.innerText.includes('Welcome back, Browser Registered Employee.')`);
 check(await evaluate(`!![...document.querySelectorAll('a')].find(a=>a.innerText==='Back to HR workspace')`),'Same HR account accesses personal ESS and can return to HR');
 await screenshot('browser-hr-personal-ess');
 check(browserEvents.filter(item=>item.method==='Runtime.exceptionThrown').length===0,'No uncaught browser runtime errors');
 fs.writeFileSync(`${directory}/browser.json`,JSON.stringify({passed:true,checks,productionBuild:true,realServerActions:true,productionAccessed:false,emailSent:false,activationFixture:'fresh test-issued invitation for the synthetic registered account',schema:identity.schema},null,2));
}
main().catch(async error=>{console.error('EMPLOYEE_BROWSER_FAILURE',error.code||error.name,error.message);fs.writeFileSync(`${directory}/browser.json`,JSON.stringify({passed:false,checks,error:error.message},null,2));if(ws)await screenshot('browser-failure').catch(()=>{});process.exitCode=1;}).finally(async()=>{if(ws){await send('Network.clearBrowserCookies').catch(()=>{});ws.close();}chrome?.kill();server?.kill();await db.$disconnect();fs.writeFileSync(`${directory}/browser-server.log`,log.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));});

// Presentation-only runner: pinned existing development database, synthetic records.
const fs = require('node:fs'), path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
if (config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu') throw Error('DEVELOPMENT_TARGET_REQUIRED');
const privatePath = '.next/demo-stabilization-fixture.json';
async function setup() {
  const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  try {
    const [state] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint,current_setting('default_transaction_read_only') AS read_only`;
    if (state.branch !== config.identity.branchId || state.endpoint !== config.identity.endpointId || state.read_only !== 'on') throw Error('DEVELOPMENT_IDENTITY_MISMATCH');
    const ledger = await db.$queryRaw`SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"`;
    if (ledger.filter(r => r.finished && !r.rolled_back).length !== 37 || ledger.some(r => !r.finished && !r.rolled_back)) throw Error('DEVELOPMENT_LEDGER_MISMATCH');
    console.log(JSON.stringify({ developmentVerified: true, appliedMigrations: 37 }));
  } finally { await db.$disconnect(); }
  if (fs.existsSync(privatePath)) { console.log('Existing isolated demo fixture retained'); return; }
  const writer = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  try {
    const org = await writer.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true, slug: true } });
    const suffix = randomBytes(5).toString('hex'), password = randomBytes(18).toString('hex');
    const email = `demo-hr-${suffix}@fixture.invalid`;
    const hr = await writer.user.create({ data: { organizationId: org.id, name: 'Demo Test HR ' + suffix, email, passwordHash: await hash(password, 12), role: 'HR_ADMIN' } });
    fs.writeFileSync(privatePath, JSON.stringify({ suffix, password, email, hrId: hr.id, organizationId: org.id, port: 3000, createdAt: new Date().toISOString() }));
    console.log(JSON.stringify({ syntheticHrCreated: true, fixtureSuffix: suffix }));
  } finally { await writer.$disconnect(); helper.assertOriginalUnchanged(config); }
}
async function start() {
  const mailboxPath = path.resolve('.next/demo-local-mailbox.json');
  const smtp = require('node:net').createServer(socket => {
    socket.setEncoding('utf8'); socket.write('220 localhost demo outbox\r\n');
    let buffer = '', data = false, content = '', to = '';
    socket.on('data', chunk => { buffer += chunk; while (buffer.includes('\r\n')) {
      const at=buffer.indexOf('\r\n'),line=buffer.slice(0,at);buffer=buffer.slice(at+2);
      if(data){if(line==='.'){const messages=fs.existsSync(mailboxPath)?JSON.parse(fs.readFileSync(mailboxPath)):[];messages.push({to,raw:content});fs.writeFileSync(mailboxPath,JSON.stringify(messages));data=false;content='';socket.write('250 local-only accepted\r\n');}else content+=line+'\r\n';continue;}
      if(/^(EHLO|HELO)/i.test(line))socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
      else if(/^AUTH PLAIN/i.test(line))socket.write('235 local-only authentication\r\n');
      else if(/^RCPT TO:/i.test(line)){const match=line.match(/<([a-z0-9.+_-]+@fixture\.invalid)>/i);if(match){to=match[1];socket.write('250 accepted synthetic recipient\r\n');}else socket.write('550 synthetic recipients only\r\n');}
      else if(/^DATA$/i.test(line)){if(!to){socket.write('554 recipient required\r\n');continue;}data=true;socket.write('354 end with dot\r\n');}
      else if(/^QUIT/i.test(line))socket.end('221 bye\r\n');else socket.write('250 ok\r\n');
    }});
  });
  await new Promise((resolve,reject)=>{smtp.once('error',reject);smtp.listen(1026,'127.0.0.1',resolve);});
  const env = { ...config.environment, NODE_OPTIONS: '--require ' + JSON.stringify(path.resolve('scripts/demo-email-guard.cjs')), EMAIL_OAUTH_ENCRYPTION_KEY: '', GOOGLE_CLIENT_SECRET: '', GOOGLE_CLIENT_ID: '', EMAIL_FROM: '', NODE_ENV: 'development' };
  const output = fs.openSync('.next/demo-stabilization-server.log', 'a');
  const child = spawn(process.execPath, ['scripts/dev-recovery.cjs', '--port', '3000'], { env, windowsHide: true, stdio: ['ignore', output, output] });
  fs.writeFileSync('.next/demo-stabilization-server-pid.json', JSON.stringify({ pid: child.pid }));
  child.on('exit', code => { console.log(JSON.stringify({ appExitCode: code })); process.exitCode = code || 0; });
  console.log(JSON.stringify({ appStarting: true, url: 'http://saga.localhost:3000', pid: child.pid, externalEmailBlocked: true }));
}
async function browser() {
  const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9230', '--user-data-dir=' + path.resolve('.next/demo-browser-profile'), 'about:blank'], { detached: true, windowsHide: true, stdio: 'ignore' });
  child.unref(); console.log('Local demo browser started');
}
async function inspect() {
 const f=JSON.parse(fs.readFileSync(privatePath));const db=new PrismaClient({datasources:{db:{url:helper.readOnly(config.direct)}},log:[]});
 try{const app=await db.application.findFirst({where:{job:{organizationId:f.organizationId},applicant:{email:`demo-applicant-${f.suffix}@fixture.invalid`}},select:{id:true,status:true,jobId:true,employee:{select:{id:true}},onboarding:{select:{id:true,status:true}}}});if(app){Object.assign(f,{applicationId:app.id,applicationPath:'/dashboard/hiring/applicants/'+app.id,jobId:app.jobId,employeeId:app.employee?.id});fs.writeFileSync(privatePath,JSON.stringify(f));}console.log(JSON.stringify({fixture:app}));}finally{await db.$disconnect();}
}
async function restart() {
 const {execFileSync}=require('node:child_process');const {pid}=JSON.parse(fs.readFileSync('.next/demo-stabilization-server-pid.json'));
 if(!Number.isInteger(pid)||pid<1)throw Error('INVALID_DEMO_PROCESS');
 try{execFileSync('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}
 await start();
}
async function exitFixture() {
 const f=JSON.parse(fs.readFileSync(privatePath));if(f.exitEmployeeId){console.log('Existing isolated exit fixture retained');return;}
 const db=new PrismaClient({datasources:{db:{url:config.direct.href}},log:[]});
 try{
  const [state]=await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint`;
  if(state.branch!==config.identity.branchId||state.endpoint!==config.identity.endpointId)throw Error('DEVELOPMENT_IDENTITY_MISMATCH');
  const created=await db.$transaction(async tx=>{
   const applicant=await tx.applicant.create({data:{firstName:'Demo',lastName:'Exit'+f.suffix,email:`demo-exit-${f.suffix}@fixture.invalid`,phone:'09000000000'}});
   const application=await tx.application.create({data:{jobId:f.jobId,applicantId:applicant.id,status:'HIRED',coverLetter:'Synthetic historical employee fixture for final exit test only.'}});
   const employee=await tx.employee.create({data:{organizationId:f.organizationId,sourceApplicationId:application.id,applicantId:applicant.id,employeeNumber:'DEMO-EXIT-'+f.suffix,firstName:applicant.firstName,lastName:applicant.lastName,email:applicant.email,phone:applicant.phone,createdById:f.hrId}});
   const original=await tx.employmentRecord.findFirstOrThrow({where:{employeeId:f.employeeId}});
   await tx.employmentRecord.create({data:{employeeId:employee.id,jobId:f.jobId,jobTitle:'Synthetic historical demo employee',department:'Demo isolated workflow',employmentCategory:'NON_TEACHING',employmentType:'Full-time',hireDate:new Date('2025-01-01Z'),startDate:new Date('2025-01-01Z'),salary:original.salary,payFrequency:original.payFrequency,employmentStatus:'REGULAR',effectiveFrom:new Date('2025-01-01Z'),createdById:f.hrId}});
   const account=await tx.employeeAccount.findUniqueOrThrow({where:{employeeId:f.employeeId},include:{user:{select:{passwordHash:true}}}});
   const user=await tx.user.create({data:{organizationId:f.organizationId,email:applicant.email,name:'Demo Exit '+f.suffix,role:'EMPLOYEE',passwordHash:account.user.passwordHash}});
   await tx.employeeAccount.create({data:{organizationId:f.organizationId,employeeId:employee.id,userId:user.id,status:'ACTIVE',activatedAt:new Date(),createdById:f.hrId}});
   return {employeeId:employee.id,userId:user.id};
  });Object.assign(f,{exitEmployeeId:created.employeeId,exitUserId:created.userId});fs.writeFileSync(privatePath,JSON.stringify(f));console.log(JSON.stringify({syntheticHistoricalExitFixtureCreated:true,employeeId:created.employeeId}));
 }finally{await db.$disconnect();helper.assertOriginalUnchanged(config);}
}
async function verifyDemo() {
 const f=JSON.parse(fs.readFileSync(privatePath));const db=new PrismaClient({datasources:{db:{url:helper.readOnly(config.direct)}},log:[]});
 try{
  const [identity]=await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch,current_setting('neon.endpoint_id',true) AS endpoint,current_setting('default_transaction_read_only') AS read_only`;
  if(identity.branch!==config.identity.branchId||identity.endpoint!==config.identity.endpointId||identity.read_only!=='on')throw Error('DEVELOPMENT_IDENTITY_MISMATCH');
  const ledger=await db.$queryRaw`SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"`;
  const result={capturedAt:new Date().toISOString(),development:identity,appliedMigrations:ledger.filter(r=>r.finished&&!r.rolled_back).length,migrationFailures:ledger.filter(r=>!r.finished&&!r.rolled_back).length,
   onboarding:await db.onboardingProcess.findUnique({where:{applicationId:f.applicationId},select:{status:true}}),
   newEmployee:await db.employee.findUnique({where:{id:f.employeeId},select:{employeeStatus:true}}),
   newEmployeeAccount:await db.employeeAccount.findUnique({where:{employeeId:f.employeeId},select:{status:true}}),
   rfidEvents:await db.attendanceEvent.count({where:{employeeId:f.employeeId,source:'RFID'}}),
   leave:await db.leaveRequest.findUnique({where:{id:f.leaveRequestId},select:{status:true}}),
   finalExit:await db.employeeSeparationCase.findUnique({where:{id:f.finalExitCasePath.split('/').pop()},select:{status:true}}),
   separatedEmployee:await db.employee.findUnique({where:{id:f.exitEmployeeId},select:{employeeStatus:true}}),
   separatedAccount:await db.employeeAccount.findUnique({where:{employeeId:f.exitEmployeeId},select:{status:true}}),
   payrollPeriods:await db.payrollPeriod.count({where:{organizationId:f.organizationId}}),payrollPolicies:await db.organizationPayrollPolicy.count({where:{organizationId:f.organizationId}}),activeCompensations:await db.employeeCompensation.count({where:{organizationId:f.organizationId,status:'ACTIVE'}}),
   fixturePayrollEntries:await db.payrollEntry.count({where:{employeeId:{in:[f.employeeId,f.exitEmployeeId]}}}),fixtureFinalPayRecords:await db.employeeFinalPay.count({where:{separationCase:{employeeId:{in:[f.employeeId,f.exitEmployeeId]}}}}),
   originalEnvUnchanged:true,productionAccessed:false};
  helper.assertOriginalUnchanged(config);fs.mkdirSync('docs/demo-stabilization',{recursive:true});fs.writeFileSync('docs/demo-stabilization/verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await db.$disconnect();helper.assertOriginalUnchanged(config);}
}
(process.argv[2] === 'start' ? start() : process.argv[2] === 'restart' ? restart() : process.argv[2] === 'browser' ? browser() : process.argv[2] === 'inspect' ? inspect() : process.argv[2] === 'exit-fixture' ? exitFixture() : process.argv[2] === 'verify' ? verifyDemo() : setup()).catch(e => { console.error(JSON.stringify({ code: /^[A-Z_]+$/.test(e.message) ? e.message : e.code || e.name, cannotReach: /Can't reach/.test(e.message) })); process.exitCode = 1; });

/* eslint-disable @typescript-eslint/no-require-imports -- Real Prisma/services/session guards; standalone Next adapters and captured email only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {randomUUID,randomBytes}=require('node:crypto');
require('tsx/cjs');
const {PrismaClient}=require('@prisma/client');
assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema')||'',/^batch3_test_[a-f0-9]{24}$/);
const db=new PrismaClient({log:[]}),jar=new Map(),checks=[],outbox=[];
const context={headers:new Headers({host:'localhost:3000'})};let emailFailure=false;
const original=Module._load;
Module._load=function(name,parent,main){
 if(name==='server-only')return {};
 if(name==='@/lib/db/prisma')return {prisma:db};
 if(name==='@/lib/email')return {sendEmployeeActivationEmail:async input=>{outbox.push(input);return {success:!emailFailure,mode:'TEST_CAPTURE'};},sendEmail:async()=>({success:true,mode:'TEST_CAPTURE'})};
 if(name==='next/headers')return {headers:async()=>context.headers,cookies:async()=>({get:key=>jar.get(key),set:(key,value,options)=>jar.set(key,{...options,value}),delete:key=>jar.delete(key)})};
 if(name==='next/navigation')return {redirect:p=>{throw Error('REDIRECT:'+p);},notFound:()=>{throw Error('NOT_FOUND');}};
 if(name==='next/cache')return {revalidatePath(){}};
 return original.call(this,name,parent,main);
};
const service=require('../src/features/employees/registration.ts'),actions=require('../src/features/employees/registration-actions.ts');
const accounts=require('../src/features/employee-self-service/accounts.ts'),access=require('../src/features/employee-self-service/access.ts');
const staff=require('../src/lib/auth/session.ts'),guards=require('../src/lib/auth/guards.ts'),security=require('../src/lib/auth/staff-security.ts');
const {landingPathForRole}=require('../src/lib/auth/routing.ts'),rbac=require('../src/lib/permissions/rbac.ts');
const {hash}=require('bcryptjs');
const form=input=>{const f=new FormData();for(const [k,v] of Object.entries(input))f.set(k,typeof v==='boolean'?(v?'yes':'no'):String(v));return f;};
function check(value,label){assert(value,label);checks.push(label);console.log('PASS',label);}
const marker=randomBytes(6).toString('hex'),password=randomBytes(18).toString('hex');
let org,other,admin,hr;
function input(extra={}){const n=randomBytes(5).toString('hex');return {registrationKey:randomUUID(),firstName:'Existing',lastName:'Employee '+n,email:n+'@fixture.invalid',phone:'09170000000',employeeNumber:'DIRECT-'+n,department:'Operations',jobTitle:'Senior Coordinator',startDate:'2025-06-01',employeeStatus:'ACTIVE',employmentStatus:'REGULAR',employmentCategory:'NON_TEACHING',employmentType:'Full-time',salary:'35000.00',payFrequency:'MONTHLY',role:'EMPLOYEE',sendInvitation:true,probationStandardsConfirmed:false,registrationReason:'Synthetic historical record reference',...extra};}
const actor=user=>({organizationId:user.organizationId,userId:user.id});
async function login(user,organization=org){jar.clear();context.headers=new Headers({host:organization.slug+'.localhost:3000'});await staff.createSession({...actor(user),name:user.name,email:user.email,role:user.role});}
const activationToken=email=>new URL(outbox.findLast(item=>item.to===email).activationUrl).hash.slice(7);
async function activate(employeeId,email){await accounts.activateEmployeeAccount({token:decodeURIComponent(activationToken(email)),password,passwordConfirmation:password});return db.user.findFirstOrThrow({where:{employeeAccount:{employeeId}}});}
async function main(){
 const passwordHash=await hash(password,12);
 org=await db.organization.create({data:{name:'Direct employee fixture',slug:'direct-'+marker}});other=await db.organization.create({data:{name:'Foreign fixture',slug:'foreign-'+marker}});
 admin=await db.user.create({data:{organizationId:org.id,name:'Org Admin',email:marker+'@admin.invalid',role:'ORGANIZATION_ADMIN',passwordHash}});
 hr=await db.user.create({data:{organizationId:org.id,name:'HR',email:marker+'@hr.invalid',role:'HR_ADMIN',passwordHash}});
 const first=input();await login(hr);
 const result=await actions.registerExistingEmployeeAction({},form({...first,organizationId:other.id}));
 check(result.employeeId&&!result.error,'Authorized HR registers an existing employee through the real server action');
 const employee=await db.employee.findUniqueOrThrow({where:{id:result.employeeId},include:{employeeAccount:{include:{user:true}},employmentRecords:true,statusHistory:true}});
 check(employee.organizationId===org.id&&employee.sourceApplicationId===null&&employee.applicantId===null&&await db.application.count({where:{job:{organizationId:org.id}}})===0&&await db.applicant.count({where:{email:first.email}})===0&&await db.job.count({where:{organizationId:org.id}})===0,'Direct registration creates no applicant, application, job or hiring records and ignores forged tenant input');
 check(employee.employmentRecords.length===1&&employee.employmentRecords[0].salary.toFixed(2)==='35000.00'&&employee.statusHistory.length===1,'Required employment details and registration audit commit with the employee');
 check(employee.employeeAccount.status==='INVITED'&&employee.employeeAccount.user.role==='EMPLOYEE'&&employee.employeeAccount.user.passwordHash===null,'Employee has exactly one securely linked invited account and no preset password');
 check(await db.employeeCompensation.count({where:{employeeId:employee.id}})===0,'Registration does not invent payroll compensation, statutory setup or opening balances');
 check(!JSON.stringify(result).includes(activationToken(first.email)),'Activation bearer is not returned in the registration response');
 check(new URL(outbox.findLast(row=>row.to===first.email).activationUrl).hostname===org.slug+'.localhost','Activation email identifies the organization workspace and retains the token only in the fragment');
 await assert.rejects(()=>accounts.activateEmployeeAccount({token:decodeURIComponent(activationToken(first.email)),password,passwordConfirmation:password,organizationId:other.id}));
 check(true,'Activation service rejects a valid invitation used for another organization');
 await activationRouting();
 const sent=outbox.length;const replay=await service.registerExistingEmployee(db,actor(hr),first);
 check(replay.idempotent&&replay.employeeId===employee.id&&outbox.length===sent,'Repeated registration key returns the original employee without a second invitation');
 await assert.rejects(()=>service.registerExistingEmployee(db,actor(hr),{...first,firstName:'Different'}));
 for(const extra of [{email:first.email.toUpperCase()},{employeeNumber:first.employeeNumber.toLowerCase()}])await assert.rejects(()=>service.registerExistingEmployee(db,actor(hr),input(extra)));
 check(true,'Changed replay payload and case-insensitive duplicate email/number are rejected');
 const parallel=input({sendInvitation:false});const concurrent=await Promise.all([service.registerExistingEmployee(db,actor(hr),parallel),service.registerExistingEmployee(db,actor(hr),parallel)]);
 check(concurrent[0].employeeId===concurrent[1].employeeId&&concurrent.filter(row=>row.idempotent).length===1,'Concurrent submissions create exactly one employee/account');
 const user=await activate(employee.id,first.email);
 await assert.rejects(()=>accounts.activateEmployeeAccount({token:decodeURIComponent(activationToken(first.email)),password,passwordConfirmation:password}));
 check((await security.authenticateStaff(db,org.id,user.email,password))?.id===user.id,'Existing activation service is single-use and the normal login authenticates the account');
 await login(user);const payload=await staff.getSession();const own=await access.resolveEmployeeSelfContext(payload,{organizationId:org.id},db);
 check(own.employee.id===employee.id,'Activated employee accesses only the linked personal ESS record');
 await assert.rejects(()=>access.resolveEmployeeSelfContext(payload,{organizationId:other.id},db));
 context.headers=new Headers({host:other.slug+'.localhost:3000'});check(await staff.getSession()===null,'Tenant session cannot be used in another workspace');
 await login(hr);
 for(const role of ['HR_ADMIN','FINANCE_OFFICER','ORGANIZATION_HEAD','ORGANIZATION_ADMIN'])check(!!(await actions.registerExistingEmployeeAction({},form(input({role})))).error,'Regular HR cannot assign '+role);
 await assert.rejects(()=>actions.changeEmployeeAccessRoleAction({},form({employeeId:employee.id,role:'HR_ADMIN',reason:'Denied',confirmed:true})),/FORBIDDEN/);
 check(true,'Regular HR cannot change access roles even when manipulating the server action');
 await login(admin);
 const change=await actions.changeEmployeeAccessRoleAction({},form({employeeId:employee.id,role:'HR_ADMIN',reason:'Approved HR assignment',confirmed:true}));
 check(change.success&&(await db.staffSession.count({where:{userId:user.id}}))===0,'Organization Administrator changes the role and revokes prior sessions atomically');
 const dual=await db.user.findUniqueOrThrow({where:{id:user.id}});await login(dual);
 check((await guards.requireBackOfficeContext()).userId===user.id&&(await access.resolveEmployeeSelfContext(await staff.getSession(),{organizationId:org.id},db)).employee.id===employee.id,'HR administrator uses the same account for HR access and personal ESS');
 await login(hr);
 await assert.rejects(()=>accounts.disableEmployeeAccount({organizationId:org.id,actorUserId:hr.id,accountId:employee.employeeAccount.id,reason:'Denied'}));
 check(true,'Existing disable-account action cannot let regular HR disable a management-role account');
 const management=[];
 for(const role of ['HR_ADMIN','FINANCE_OFFICER','ORGANIZATION_HEAD']){
  await login(admin);const data=input({role});const created=await service.registerExistingEmployee(db,actor(admin),data);const account=await db.employeeAccount.findFirstOrThrow({where:{employeeId:created.employeeId}});
  await assert.rejects(()=>service.changeEmployeeAccessRole(db,actor(admin),{employeeId:created.employeeId,role:'EMPLOYEE',reason:'Pending account'}));
  await assert.rejects(()=>accounts.resendEmployeeInvitation({organizationId:org.id,actorUserId:hr.id,accountId:account.id}));
  const member=await activate(created.employeeId,data.email);await login(member);
  check((await access.resolveEmployeeSelfContext(await staff.getSession(),{organizationId:org.id},db)).employee.id===created.employeeId,role+' activation and personal ESS use existing authentication');
  if(role!=='HR_ADMIN'){
   check(landingPathForRole(member.role)==='/employee'&&!rbac.canManageEmployees(await staff.getSession())&&!rbac.canManagePayroll(await staff.getSession()),role+' receives no HR/payroll/unfinished workspace privileges');
   await assert.rejects(()=>guards.requireBackOfficeContext());await assert.rejects(()=>actions.registerExistingEmployeeAction({},form(input())));
  }
  management.push({member,employeeId:created.employeeId,accountId:account.id});
 }
 check(true,'Pending invitations cannot be promoted and regular HR cannot rotate management invitation tokens');
 const pending=input();const invited=await service.registerExistingEmployee(db,actor(hr),pending);const account=await db.employeeAccount.findFirstOrThrow({where:{employeeId:invited.employeeId}});
 const expiredToken=decodeURIComponent(activationToken(pending.email));
 await db.employeeAccount.update({where:{id:account.id},data:{activationTokenExpiresAt:new Date(Date.now()-1)}});
 await assert.rejects(()=>accounts.activateEmployeeAccount({token:expiredToken,password,passwordConfirmation:password}));
 await accounts.resendEmployeeInvitation({organizationId:org.id,actorUserId:hr.id,accountId:account.id});
 await assert.rejects(()=>accounts.activateEmployeeAccount({token:expiredToken,password,passwordConfirmation:password}));
 check(activationToken(pending.email)!==expiredToken,'Expired and replaced activation tokens cannot activate an account');
 check(outbox.findLast(item=>item.to===pending.email),'Existing invitation resend still works for ordinary employees');
 const disabled=input({employeeStatus:'INACTIVE'});const disabledCount=outbox.length;const inactive=await service.registerExistingEmployee(db,actor(hr),disabled);
 check((await db.employeeAccount.findFirstOrThrow({where:{employeeId:inactive.employeeId}})).status==='DISABLED'&&outbox.length===disabledCount,'Inactive employee registration creates a disabled account and sends no invitation');
 await login(admin);
 const prior=await db.user.create({data:{organizationId:org.id,name:'Existing activated HR',email:marker+'@existing.invalid',role:'HR_ADMIN',passwordHash}});
 const oldHash=prior.passwordHash;const linked=await service.registerExistingEmployee(db,actor(admin),input({email:prior.email,role:'HR_ADMIN',existingUserId:prior.id}));
 const link=await db.employeeAccount.findFirstOrThrow({where:{employeeId:linked.employeeId}});
 check(link.userId===prior.id&&link.status==='ACTIVE'&&(await db.user.findUniqueOrThrow({where:{id:prior.id}})).passwordHash===oldHash,'Explicit existing-HR linking preserves one account, password and access role');
 await login(prior);check((await access.resolveEmployeeSelfContext(await staff.getSession(),{organizationId:org.id},db)).employee.id===linked.employeeId,'Previously existing HR account gains only its explicitly linked personal ESS record');
 const legacyEmail=marker+'@unlinked-existing.invalid';
 const unlinked=await db.employee.create({data:{organizationId:org.id,employeeNumber:'UNLINKED-'+marker,firstName:'Previously',lastName:'Recorded',email:legacyEmail,phone:'0',createdById:hr.id}});
 await db.employmentRecord.create({data:{employeeId:unlinked.id,jobTitle:'Existing job title',department:'Operations',employmentCategory:'NON_TEACHING',employmentType:'Full-time',hireDate:new Date('2025-01-01Z'),startDate:new Date('2025-01-01Z'),effectiveFrom:new Date('2025-01-01Z'),employmentStatus:'REGULAR',salary:35000,payFrequency:'MONTHLY',createdById:hr.id}});
 const existingLogin=await db.user.create({data:{organizationId:org.id,name:'Already employed HR',email:legacyEmail,role:'HR_ADMIN',passwordHash}});
 await assert.rejects(()=>service.linkExistingEmployeeAccount(db,actor(hr),{employeeId:unlinked.id,existingUserId:existingLogin.id,reason:'Denied'}));
 await login(admin);
 check((await actions.linkExistingEmployeeAccountAction({},form({employeeId:unlinked.id,existingUserId:existingLogin.id,reason:'Match existing personnel record',confirmed:true}))).success,'Organization Administrator can link an existing account to an employee already in the directory');
 check((await db.employeeAccount.findFirstOrThrow({where:{employeeId:unlinked.id}})).userId===existingLogin.id&&(await db.user.findUniqueOrThrow({where:{id:existingLogin.id}})).passwordHash===passwordHash,'Existing-employee linking creates no duplicate user and preserves the password');
 const foreignUser=await db.user.create({data:{organizationId:other.id,name:'Foreign HR',email:marker+'@foreign.invalid',role:'HR_ADMIN',passwordHash}});
 const count=await db.employee.count({where:{organizationId:org.id}});
 await assert.rejects(()=>service.registerExistingEmployee(db,actor(admin),input({email:foreignUser.email,role:'HR_ADMIN',existingUserId:foreignUser.id})));
 await assert.rejects(()=>service.registerExistingEmployee(db,actor(hr),input({existingUserId:foreignUser.id})));
 check(await db.employee.count({where:{organizationId:org.id}})===count,'Invalid or cross-tenant linking rolls back employee, employment and account together');
 await assert.rejects(()=>service.changeEmployeeAccessRole(db,{organizationId:other.id,userId:admin.id},{employeeId:employee.id,role:'EMPLOYEE',reason:'Denied'}));
 await assert.rejects(()=>db.user.update({where:{id:prior.id},data:{organizationId:other.id}}));
 check(true,'Server and database reject cross-tenant role changes and linked-user reassignment');
 await service.changeEmployeeAccessRole(db,actor(admin),{employeeId:employee.id,role:'EMPLOYEE',reason:'Return to employee role'});
 check((await db.user.findUniqueOrThrow({where:{id:user.id}})).role==='EMPLOYEE'&&await db.employeeAccountAudit.count({where:{employeeAccountId:employee.employeeAccount.id,action:'ROLE_CHANGED'}})===2,'Role changes preserve the employee link and append before/after audit events');
 const event=await db.employeeAccountAudit.findFirstOrThrow({where:{action:'ROLE_CHANGED'}});await assert.rejects(()=>db.employeeAccountAudit.delete({where:{id:event.id}}));
 check(true,'Existing append-only account audit protection applies to role changes');
 emailFailure=true;const failedMail=input();const mailResult=await service.registerExistingEmployee(db,actor(hr),failedMail);emailFailure=false;
 check(mailResult.warning&&(await db.employeeAccount.findFirstOrThrow({where:{employeeId:mailResult.employeeId}})).status==='INVITED','Email failure retains the committed invited account with a recoverable warning');
 await conversionRegression();
 fs.mkdirSync('docs/employee-registration/verification',{recursive:true});fs.writeFileSync('docs/employee-registration/verification/scenarios.json',JSON.stringify({passed:true,checks,emailTransport:'captured; no email sent',realDatabase:true,realSessionGuards:true},null,2));
 console.log(JSON.stringify({passed:true,scenarios:checks.length}));
}
async function conversionRegression(){
 const numberDomain=require('../src/features/employees/domain.ts');
 const reserved=numberDomain.formatEmployeeNumber(numberDomain.normalizeEmployeeNumberPrefix(null,org.slug),new Date().getUTCFullYear(),1);
 await service.registerExistingEmployee(db,actor(hr),input({employeeNumber:reserved,sendInvitation:false}));
 const ts=require('typescript');const filename=path.resolve('scripts/test-h1-employee-core.ts');let source=fs.readFileSync(filename,'utf8').split('async function main()')[0].replace('contractExecutedAt: new Date(),','contractExecutedAt: input.startDate,');
 const fixture=new Module(filename,module);fixture.filename=filename;fixture.paths=Module._nodeModulePaths(path.dirname(filename));fixture._compile(ts.transpileModule(source+'\nmodule.exports={createReadyApplication};',{compilerOptions:{module:1,target:9,esModuleInterop:true}}).outputText,filename);
 const {resolveHiringDocumentPolicy}=require('../src/features/hiring/document-policy.ts'),{getOnboardingTaskTemplates}=require('../src/features/hiring/onboarding-pipeline.ts');
 const data=await fixture.exports.createReadyApplication({organizationId:org.id,actorUserId:hr.id,category:'NON_TEACHING',email:marker+'@candidate.invalid',firstName:'Recruitment',jobSuffix:marker,startDate:new Date('2026-06-01T00:00:00Z')});
 const policy=resolveHiringDocumentPolicy({...org,hiringDocumentRequirements:null},'NON_TEACHING');
 const process=await db.onboardingProcess.findUniqueOrThrow({where:{applicationId:data.application.id}});
 const templates=getOnboardingTaskTemplates(policy,'NON_TEACHING');
 for(const template of templates)await db.onboardingTask.create({data:{onboardingProcessId:process.id,title:template.title,type:template.type,isRequired:template.isRequired,status:'VERIFIED',verifiedAt:new Date(),verifiedById:hr.id}});
 const {convertApplicationToEmployee}=require('../src/features/employees/conversion.ts');const conversionInput={organizationId:org.id,actorUserId:hr.id,applicationId:data.application.id,probationStandardsConfirmed:true};
 await assert.rejects(()=>convertApplicationToEmployee({...conversionInput,organizationId:other.id}));
 const result=await convertApplicationToEmployee(conversionInput);const repeat=await convertApplicationToEmployee(conversionInput);
 check(result.employeeId===repeat.employeeId&&repeat.idempotent,'Recruitment conversion still creates one employee and idempotently preserves source/offer/probation records');
 const converted=await db.employee.findUniqueOrThrow({where:{id:result.employeeId},include:{employmentRecords:{include:{probation:true}}}});
 check(converted.employeeNumber!==reserved,'Recruitment numbering skips employee numbers already imported by direct registration');
 check(converted.sourceApplicationId===data.application.id&&converted.applicantId===data.applicant.id&&converted.employmentRecords[0].probation,'Converted employee retains the existing hiring provenance and probation workflow');
 await accounts.provisionEmployeeAccount({organizationId:org.id,employeeId:converted.id,actorUserId:hr.id});
 check((await db.employeeAccount.findFirstOrThrow({where:{employeeId:converted.id}})).status==='INVITED','Existing recruitment-created employee reuses the same account provisioning service');
}
async function activationRouting(){
 const savedRoot=process.env.PLATFORM_ROOT_DOMAIN,savedPublic=process.env.PLATFORM_PUBLIC_ORIGIN;
 try {
  process.env.PLATFORM_ROOT_DOMAIN='employee-routing-fixture.vercel.app';process.env.PLATFORM_PUBLIC_ORIGIN='https://employee-routing-fixture.vercel.app';
  const {proxy}=require('../src/proxy.ts'),{NextRequest}=require('next/server');
  const request=route=>new NextRequest('https://employee-routing-fixture.vercel.app'+route,{headers:{host:'employee-routing-fixture.vercel.app'}});
  const response=await proxy(request('/w/'+org.slug+'/activate/employee'));
  check(response.status===200&&new URL(response.headers.get('x-middleware-rewrite')).pathname==='/activate/employee','Shared-path employee invitations resolve an unauthenticated tenant activation route');
  await db.organization.upsert({where:{slug:'st-aloysius'},create:{slug:'st-aloysius',name:'Synthetic SAGA activation fixture'},update:{}});
  const saga=await proxy(request('/saga/activate/employee'));
  check(saga.status===200&&new URL(saga.headers.get('x-middleware-rewrite')).pathname==='/activate/employee','SAGA employee activation reuses the existing protected workspace routing');
 }finally{process.env.PLATFORM_ROOT_DOMAIN=savedRoot;process.env.PLATFORM_PUBLIC_ORIGIN=savedPublic;}
}
main().catch(error=>{console.error('EMPLOYEE_REGISTRATION_TEST_FAILURE',error.code||error.name,String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));process.exitCode=1;}).finally(async()=>{Module._load=original;await db.$disconnect();});

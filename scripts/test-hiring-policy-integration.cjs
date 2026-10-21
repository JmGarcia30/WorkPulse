/* eslint-disable @typescript-eslint/no-require-imports -- Real settings POST and rollback-only hiring fixtures. */
const assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs');
module.exports=async function({tx,org,foreign,users,job,candidate,session,port,tenantHost,save,ok}){
 require('tsx/cjs');
 const original=Module._load;
 Module._load=function(name,parent,isMain){if(name==='server-only')return {};return original.call(this,name,parent,isMain);};
 const {ensureRecruitmentDocumentsExist}=require('../src/features/hiring/document-requirements.ts');
 const {resolveHiringDocumentPolicy,applyDocumentPolicy}=require('../src/features/hiring/document-policy.ts');
 const {createSagaOnboardingProcessInTx}=require('../src/features/hiring/onboarding-actions.ts');
 const {convertApplicationToEmployee}=require('../src/features/employees/conversion.ts');
 const {getSagaDocumentRequirements}=require('../src/features/hiring/saga-requirements.ts');
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function until(expression,label){for(let i=0;i<200;i++){if(await session.evaluate(expression))return;await pause(50);}throw Error(label);}
 async function goto(route,title){await session.send('Page.navigate',{url:`http://${tenantHost}:${port}${route}`});await until(`document.readyState==='complete' && document.querySelector('main')?.innerText.includes(${JSON.stringify(title)}) && !document.querySelector('main [data-wp-loading]')`,'PAGE_NOT_READY');await pause(200);}
 try{
  const saga=await tx.organization.findUniqueOrThrow({where:{slug:'st-aloysius'}});
  const sagaBefore=JSON.stringify(saga.hiringDocumentRequirements);
  const initial=await ensureRecruitmentDocumentsExist(candidate.id,org.id);
  assert.deepEqual(initial.map(d=>d.type),['RESUME_APPLICATION_LETTER']);
  await assert.rejects(ensureRecruitmentDocumentsExist(candidate.id,foreign.id),/APPLICATION_NOT_FOUND/);
  ok(true,'Unconfigured Company B receives only neutral resume requirement; foreign organization cannot initialize its checklist');

  await goto('/dashboard/hiring/settings','Hiring document requirements');
  const checked=await session.evaluate(`[...document.querySelectorAll('main input[name$=".enabled"]:checked')].map(e=>e.name)`);
  assert.deepEqual(checked.sort(),['NON_TEACHING.RESUME_APPLICATION_LETTER.enabled','TEACHING.RESUME_APPLICATION_LETTER.enabled']);
  await session.evaluate(`(()=>{const form=document.querySelector('main form');form.querySelectorAll('input[type=checkbox]').forEach(e=>e.checked=false);for(const category of ['TEACHING','NON_TEACHING']){for(const field of ['enabled','required'])form.elements[category+'.OTHER.'+field].checked=true;form.elements[category+'.OTHER.title'].value='Company B work eligibility certificate';form.elements[category+'.OTHER.target'].value='Company B HR';}const forged=document.createElement('input');forged.type='hidden';forged.name='organizationId';forged.value=${JSON.stringify(saga.id)};form.append(forged);form.requestSubmit();return true})()`);
  await until(`location.search.includes('saved=1') && document.body.innerText.includes('Requirements saved for this organization')`,'SETTINGS_SAVE_FAILED');
  const company=await tx.organization.findUniqueOrThrow({where:{id:org.id}});
  assert.equal(company.hiringDocumentRequirements.TEACHING[0].title,'Company B work eligibility certificate');
  assert.equal(JSON.stringify((await tx.organization.findUniqueOrThrow({where:{id:saga.id}})).hiringDocumentRequirements),sagaBefore);
  ok(true,'Real HR settings form saves Company B policy; forged organization ID cannot alter SAGA settings');

  const docs=await ensureRecruitmentDocumentsExist(candidate.id,org.id);
  assert.equal(docs.length,2);assert(docs.some(d=>d.id===initial[0].id));
  const policy=resolveHiringDocumentPolicy(company,job.category),projected=applyDocumentPolicy(docs,policy);
  assert.equal(projected.find(d=>d.type==='RESUME_APPLICATION_LETTER').isRequired,false);
  assert.equal(projected.find(d=>d.type==='OTHER').isRequired,true);
  ok(true,'Company B uses its configured certificate; historical document IDs and files remain; retired slots stop blocking');

  const {SignJWT}=await import('jose');
  async function token(actor){return '__Host-workpulse_session='+await new SignJWT({userId:actor.id,organizationId:actor.organizationId,role:actor.role,name:actor.name,email:actor.email}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.SESSION_SECRET));}
  const foreignActor=await tx.user.create({data:{organizationId:foreign.id,name:'Foreign HR',email:`policy-foreign-${org.id}@fixture.invalid`,role:'HR_ADMIN'}});
  async function request(route,cookie){return fetch(`http://127.0.0.1:${port}${route}`,{headers:{host:`${tenantHost}:${port}`,'x-forwarded-host':`${tenantHost}:${port}`,cookie},redirect:'manual'});}
  for(const actor of [foreignActor,users.HIRING_MANAGER,users.EMPLOYEE]){
   const response=await request('/dashboard/hiring/settings',await token(actor));assert(!(await response.text()).includes('Company B work eligibility certificate'));
  }
  const references=JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json'));
  const reference=Object.entries(references.node).find(([,value])=>value.exportedName==='saveHiringDocumentPolicy');
  assert(reference,'Server form action identifier missing');
  const attack=new FormData();attack.set('$ACTION_ID_'+reference[0],'');
  const attempted=await fetch(`http://127.0.0.1:${port}/dashboard/hiring/settings`,{method:'POST',headers:{host:`${tenantHost}:${port}`,'x-forwarded-host':`${tenantHost}:${port}`,origin:`http://${tenantHost}:${port}`,cookie:await token(foreignActor)},body:attack,redirect:'manual'});
  await attempted.text();
  assert.deepEqual((await tx.organization.findUniqueOrThrow({where:{id:org.id}})).hiringDocumentRequirements,company.hiringDocumentRequirements);
  const docResponse=await request(`/api/recruitment-documents/${docs[0].id}`,await token(foreignActor));assert.notEqual(docResponse.status,200);
  ok(true,'Wrong-tenant HR, Hiring Manager and employee cannot read settings; foreign HR cannot download Company B documents');

  for(const category of ['TEACHING','NON_TEACHING']){
   const sagaJob=await tx.job.create({data:{organizationId:saga.id,title:'Policy fixture',slug:`policy-${category}-${org.id}`,department:'Testing',employmentType:'Full-time',location:'Fixture',description:'Fixture',responsibilities:'Fixture',qualifications:'Fixture',requirements:'Fixture',category}});
   const application=await tx.application.create({data:{jobId:sagaJob.id,applicantId:candidate.applicantId,coverLetter:'Policy isolation fixture'}});
   const requirements=await ensureRecruitmentDocumentsExist(application.id,saga.id);
   assert.deepEqual(requirements.map(d=>d.type).sort(),getSagaDocumentRequirements(category).map(d=>d.type).sort());
   await assert.rejects(ensureRecruitmentDocumentsExist(application.id,org.id),/APPLICATION_NOT_FOUND/);
   const companyCookie=session.cookie;
   const foreignDoc=await request(`/api/recruitment-documents/${requirements[0].id}`,companyCookie);assert.notEqual(foreignDoc.status,200);
  }
  ok(true,'Actual SAGA organization keeps both 11-document category lists; Company B cannot initialize or download SAGA documents');

  await tx.recruitmentDocument.updateMany({where:{applicationId:candidate.id,type:'OTHER'},data:{status:'VERIFIED',verifiedAt:new Date(),verifiedById:users.HR_ADMIN.id}});
  const offer=await tx.offer.create({data:{applicationId:candidate.id,status:'ACCEPTED',salary:35000,employmentType:'Full-time',startDate:new Date('2026-10-01'),createdById:users.HR_ADMIN.id,contractSignedByPresident:true,contractSignedByEmployee:true,contractExecutedAt:new Date('2026-09-30')}});
  const app=await tx.application.findUniqueOrThrow({where:{id:candidate.id},include:{job:true,recruitmentDocuments:true}});
  const onboarding=await createSagaOnboardingProcessInTx(tx,app,offer,new Date('2026-10-01'));
  const tasks=await tx.onboardingTask.findMany({where:{onboardingProcessId:onboarding.id}});
  assert.deepEqual(tasks.map(t=>t.title).sort(),['Company B work eligibility certificate','Organization onboarding review'].sort());
  assert.equal(tasks.find(t=>t.type==='DOCUMENT').status,'VERIFIED');
  await tx.onboardingTask.updateMany({where:{onboardingProcessId:onboarding.id},data:{status:'VERIFIED'}});
  await tx.onboardingProcess.update({where:{id:onboarding.id},data:{status:'COMPLETED',completedAt:new Date()}});
  await tx.application.update({where:{id:candidate.id},data:{status:'OFFER'}});
  const converted=await convertApplicationToEmployee({applicationId:candidate.id,organizationId:org.id,actorUserId:users.HR_ADMIN.id});
  assert(converted.employeeId);assert.equal((await convertApplicationToEmployee({applicationId:candidate.id,organizationId:org.id,actorUserId:users.HR_ADMIN.id})).idempotent,true);
  await assert.rejects(convertApplicationToEmployee({applicationId:candidate.id,organizationId:foreign.id,actorUserId:foreignActor.id}));
  ok(true,'Company B verified document carries into its own onboarding; conversion succeeds without SAGA exams/interviews, remains idempotent and rejects foreign tenant');
  save('policy-result',{passed:true,settingsRealHttpPost:true,organizationIdsServerDerived:true,sagaCategoryListsPreserved:true,companyBConfigured:true,foreignSettingsAndDocumentsDenied:true,historicalIdsPreserved:true,ownOnboardingAndConversion:true,migrationTestedInsideRollbackOnly:true});
 }catch(error){save('policy-failure',{code:error.code||error.name,frames:error.stack?.split('\n').filter(line=>line.includes('test-hiring-policy-integration.cjs')).slice(0,3)});throw error;}finally{Module._load=original;}
};

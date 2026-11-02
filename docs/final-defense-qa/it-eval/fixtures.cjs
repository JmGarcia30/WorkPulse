const { hash } = require('bcryptjs'), { randomBytes } = require('node:crypto');
module.exports = async function fixtures(db) {
  const password = randomBytes(18).toString('hex'), passwordHash = await hash(password, 4);
  const platform = await db.platformAdministrator.create({data:{email:'platform-'+randomBytes(6).toString('hex')+'@fixture.invalid',name:'Synthetic Platform Operator',passwordHash}});
  async function tenant(suffix) {
    const org = await db.organization.create({ data: { slug:'it-eval-'+randomBytes(5).toString('hex')+'-'+suffix, name:'Fictional IT Evaluation '+suffix,timeZone:'Asia/Manila' } });
    await db.organizationBranding.create({ data:{organizationId:org.id,displayName:org.name,primaryColor:'#0f766e',accentColor:'#ca8a04'} });
    const users={};
    for(const role of ['HR_ADMIN','ORGANIZATION_ADMIN','HIRING_MANAGER','EMPLOYEE']) users[role]=await db.user.create({data:{organizationId:org.id,role,name:'Fictional '+role,email:role.toLowerCase()+'-'+org.slug+'@fixture.invalid',passwordHash}});
    // Synthetic invitation activation proves only these fictional mailboxes.
    await db.organizationAdministratorInvitation.create({data:{organizationId:org.id,userId:users.HR_ADMIN.id,email:users.HR_ADMIN.email,status:'ACTIVATED',activatedAt:new Date(),createdById:platform.id,creationKey:randomBytes(16).toString('hex'),requestHash:randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+3600000)}});
    await db.companyRegistration.create({data:{organizationId:org.id,email:users.ORGANIZATION_ADMIN.email,companyName:org.name,administratorName:users.ORGANIZATION_ADMIN.name,browserHash:randomBytes(32).toString('hex'),verifiedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
    const jobData={organizationId:org.id,title:'Synthetic draft',slug:'fixture-job',department:'Test',employmentType:'Full-time',location:'Test',description:'Test',responsibilities:'Test',qualifications:'Test',requirements:'Test',category:'NON_TEACHING',status:'DRAFT'};
    const job=await db.job.create({data:jobData});
    const applicant=await db.applicant.create({data:{firstName:'Synthetic',lastName:suffix,email:'applicant-'+org.slug+'@fixture.invalid',phone:'0'}});
    const application=await db.application.create({data:{jobId:job.id,applicantId:applicant.id,status:'HIRED',coverLetter:'Disposable IT evaluation'}});
    const employee=await db.employee.create({data:{organizationId:org.id,applicantId:applicant.id,sourceApplicationId:application.id,employeeNumber:'IT-'+suffix,firstName:'Synthetic',lastName:suffix,email:applicant.email,phone:'0',createdById:users.HR_ADMIN.id}});
    await db.employeeAccount.create({data:{organizationId:org.id,userId:users.EMPLOYEE.id,employeeId:employee.id,status:'ACTIVE',activatedAt:new Date(),createdById:users.HR_ADMIN.id}});
    return {org,users,employee,job,jobData};
  }
  return {password,passwordHash,platform,a:await tenant('alpha'),b:await tenant('beta')};
};

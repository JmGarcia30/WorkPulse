// Reuse existing suites without editing them or their saved evidence; rebase guards to the verified clone.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{createHash}=require('node:crypto');
const e=require('./environment.cjs'),real=require('../../../scripts/batch0-recovery-environment.cjs'),base=real.configuration(),url=new URL(process.env.DATABASE_URL),schema=url.searchParams.get('schema');
if(!/^(batch3_test_|staff_auth_test_)[a-f0-9]{24}$/.test(schema)||url.hostname!=='ep-patient-cake-az9urbbj.c-3.ap-southeast-1.aws.neon.tech')throw Error('WRONG_CLONE_SCHEMA');
const cloneIdentity={...base.identity,branchId:e.identity.branch,endpointId:e.identity.endpoint,endpointSha256:real.digest(url.hostname),distinctFromProtectedOriginal:true,consoleMappingComplete:true};
const helper={...real,configuration:()=>({...base,direct:url,pooled:url,environment:{...base.environment,...process.env},identity:cloneIdentity})};
const write=fs.writeFileSync.bind(fs),read=fs.readFileSync.bind(fs),mkdir=fs.mkdirSync.bind(fs),load=Module._load;
const destination=file=>{const name=String(file).replaceAll('\\','/'),relative=path.isAbsolute(name)?path.relative(process.cwd(),file).replaceAll('\\','/'):name;return relative.startsWith('docs/')&&!relative.startsWith('docs/final-defense-qa/release-blockers/')?path.join(e.root,'reused',relative):file;};
fs.writeFileSync=(file,...args)=>{file=destination(file);mkdir(path.dirname(file),{recursive:true});return write(file,...args);};
fs.readFileSync=(file,...args)=>{const name=String(file).replaceAll('\\','/');let value=read(file,...args);if(name.endsWith('schema-and-history-verification.json')){const p=JSON.parse(value);p.identity={...p.identity,...cloneIdentity};return JSON.stringify(p);}if(name.endsWith('database-preflight.json')&&name.includes('hiring-final-verification')){const p=JSON.parse(value);p.identity={...p.identity,branch_id:e.identity.branch,endpoint_id:e.identity.endpoint};p.appliedMigrations=40;return JSON.stringify(p);}if(name.endsWith('hiring-postgres-fixtures.cjs')){value=String(value).replaceAll('br-damp-fog-azmmxhga',e.identity.branch).replaceAll('ep-wild-mud-az8yzifu',e.identity.endpoint).replace('preflight.appliedMigrations, 38','preflight.appliedMigrations, 40');}return value;};
Module._load=function(name,parent,main){if(name==='server-only')return {};if(name==='./batch0-recovery-environment.cjs'||name.endsWith('/scripts/batch0-recovery-environment.cjs'))return helper;return load.call(this,name,parent,main);};
// Legacy platform suite predates active EmployeeAccount prerequisites. Configure its employee fixture; never weaken production guards.
const platformFixture=path.resolve('scripts/test-platform-admin.cjs');
const platformLoad=Module._load;
Module._load=function(name,parent,main){if(path.resolve(name)===platformFixture){let source=read(platformFixture,'utf8');const anchor='      await tenantSession.createSession({ userId: user.id, name: user.name, email: user.email, organizationId: orgA.id, role });';if(!source.includes(anchor))throw Error('PLATFORM_FIXTURE_ANCHOR');source=source.replace(anchor,`      if(role==='EMPLOYEE') {
        await assert.rejects(()=>tenantSession.createSession({userId:user.id,name:user.name,email:user.email,organizationId:orgA.id,role}));
        const actor=await db.user.findFirstOrThrow({where:{organizationId:orgA.id,role:'HR_ADMIN'}});
        const job=await db.job.create({data:{organizationId:orgA.id,title:'Synthetic employee fixture',slug:'platform-employee',department:'Test',employmentType:'Full-time',location:'Test',description:'Test',responsibilities:'Test',qualifications:'Test',requirements:'Test'}});
        const applicant=await db.applicant.create({data:{firstName:'Synthetic',lastName:'Employee',email:user.email,phone:'0'}});
        const application=await db.application.create({data:{jobId:job.id,applicantId:applicant.id,status:'HIRED',coverLetter:'Synthetic platform isolation'}});
        const employee=await db.employee.create({data:{organizationId:orgA.id,applicantId:applicant.id,sourceApplicationId:application.id,employeeNumber:'PLATFORM-QA',firstName:'Synthetic',lastName:'Employee',email:user.email,phone:'0',createdById:actor.id}});
        await db.employeeAccount.create({data:{organizationId:orgA.id,userId:user.id,employeeId:employee.id,status:'ACTIVE',activatedAt:new Date(),createdById:actor.id}});
      }
`+anchor);source=source.replace('fixturesRemoved: true','fixturesRetainedInOwnedSchema: true').replace(/    if \(ids.length\) \{ await db.user.deleteMany[^\n]+/,'    // Keep dependent synthetic fixtures in the owned schema; do not cascade-delete history.');const m=new Module(platformFixture,module);m.filename=platformFixture;m.paths=Module._nodeModulePaths(path.dirname(platformFixture));m._compile(source,platformFixture);return m.exports;}return platformLoad.call(this,name,parent,main);};
const file=process.argv[2];process.argv.splice(2,1);require(path.resolve(file));

/* eslint-disable @typescript-eslint/no-require-imports -- Production verification: guarded SELECT-only database connection and public GET requests. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{parseEnv}=require('node:util'),{createHash}=require('node:crypto');
require('tsx/cjs');const {PrismaClient}=require('@prisma/client');
const {databaseTarget,verifyDatabaseIdentity,productionDatabase}=require('../src/lib/db/environment-safety.ts');
const directory='docs/final-plan-release/verification';fs.mkdirSync(directory,{recursive:true});
const profile=parseEnv(fs.readFileSync('.env','utf8')),source=new URL(profile.DATABASE_URL);
databaseTarget({VERCEL:'1',VERCEL_ENV:'production',DATABASE_URL:source.href,WORKPULSE_DB_PROJECT_ID:productionDatabase.project,WORKPULSE_DB_BRANCH_ID:productionDatabase.branch,WORKPULSE_DB_ENDPOINT_ID:productionDatabase.endpoint,WORKPULSE_DB_DATABASE:productionDatabase.database});
source.hostname=source.hostname.replace('-pooler.','.');source.searchParams.set('options','-c default_transaction_read_only=on -c statement_timeout=20000');
const db=new PrismaClient({datasources:{db:{url:source.href}},log:[]});
async function main(){
 const identity=await verifyDatabaseIdentity(productionDatabase,()=>db.$queryRaw`SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id`);
 const [mode]=await db.$queryRaw`SELECT current_setting('transaction_read_only') AS mode`;assert.equal(mode.mode,'on');
 const applied=await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;
 const successful=applied.filter(row=>row.finished&&!row.rolled_back);
 const local=fs.readdirSync('prisma/migrations',{withFileTypes:true}).filter(row=>row.isDirectory()&&fs.existsSync('prisma/migrations/'+row.name+'/migration.sql')).map(row=>row.name);
 const mismatches=[];for(const row of successful){if(!local.includes(row.migration_name)){mismatches.push(row.migration_name);continue;}const content=fs.readFileSync('prisma/migrations/'+row.migration_name+'/migration.sql','utf8');const hashes=[content,content.replace(/\r\n/g,'\n'),content.replace(/\r?\n/g,'\r\n')].map(x=>createHash('sha256').update(x).digest('hex'));if(!hashes.includes(row.checksum))mismatches.push(row.migration_name);}
 const columns=await db.$queryRaw`SELECT table_name,column_name,is_nullable FROM information_schema.columns WHERE table_schema='public' AND ((table_name='Employee' AND column_name IN ('sourceApplicationId','applicantId','registrationKey')) OR (table_name='OrganizationSubscription' AND column_name='legacyAccess'))`;
 const roles=await db.$queryRaw`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='Role' ORDER BY enumsortorder`;
 const models=await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('SubscriptionRequest','OrganizationSubscription','SubscriptionPlan','SubscriptionEvent','EmployeeAccount','StaffSession')`;
 const planCatalog=await db.subscriptionPlan.findMany({select:{tier:true,monthlyPriceMinor:true,yearlyPriceMinor:true,maxEmployees:true,aiResumeParsing:true,advancedAnalytics:true,gmailIntegration:true,customBranding:true,active:true},orderBy:{tier:'asc'}});
 const accountAvailability={hr:await db.user.count({where:{role:{in:['HR_ADMIN','ORGANIZATION_ADMIN']},passwordHash:{not:null}}}),activeEmployee:await db.employeeAccount.count({where:{status:'ACTIVE',employee:{employeeStatus:'ACTIVE'},user:{passwordHash:{not:null}}}}),platform:await db.platformAdministrator.count({where:{disabledAt:null}})};
 const result={capturedAt:new Date().toISOString(),identity:{...identity,projectVerification:'provider project/branch/compute mapping checked separately'},readOnly:true,successfulMigrations:successful.length,committedMigrations:local.length,pending:local.filter(name=>!successful.some(row=>row.migration_name===name)),checksumMismatches:mismatches,unfinished:applied.filter(row=>!row.finished&&!row.rolled_back).map(row=>row.migration_name),columns,roles:roles.map(row=>row.enumlabel),models:models.map(row=>row.table_name),accountAvailability};
 result.planCatalog=planCatalog;
 fs.writeFileSync(directory+'/production-database.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 const paths=['/','/saga/login','/platform/login','/saga/dashboard/employees','/saga/dashboard/employees/new','/saga/employee','/saga/employee/payroll','/saga/dashboard/payroll','/saga/dashboard/leave','/saga/dashboard/attendance','/saga/attendance-kiosk','/saga/dashboard/subscription','/platform/subscriptions'];
 const checks=await Promise.all(paths.map(async path=>{const start=Date.now();try{const response=await fetch('https://work-pulse-omega.vercel.app'+path,{redirect:'manual',signal:AbortSignal.timeout(30000)});const body=await response.text();return {path,status:response.status,location:response.headers.get('location'),html:response.headers.get('content-type')?.includes('text/html'),renderedServerError:/Application error: a server-side exception|Internal Server Error/.test(body),elapsedMs:Date.now()-start};}catch(error){return {path,error:error.name};}}));
 fs.writeFileSync(directory+'/production-http.json',JSON.stringify({capturedAt:new Date().toISOString(),authenticated:false,checks},null,2));console.log(JSON.stringify({http:checks}));
}
main().catch(error=>{console.error('PRODUCTION_READONLY_VERIFICATION_FAILED',error.code||error.name);process.exitCode=1;}).finally(()=>db.$disconnect());

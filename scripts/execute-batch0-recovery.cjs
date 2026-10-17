// Explicitly authorized testing-branch operations. Never selects the original endpoint.
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {PrismaClient,Prisma}=require('@prisma/client');
const helper=require('./batch0-recovery-environment.cjs');
const config=helper.configuration();
const mode=process.argv[2]||'verify';
const prior=JSON.parse(fs.readFileSync(path.join(helper.directory,'connection-verification.json')));
if(prior.endpointSha256!==config.identity.endpointSha256||prior.originalEnvSha256!==config.identity.originalEnvSha256)helper.fail('VERIFIED_TARGET_CHANGED');
const authorization={branch:'workpulse-batch0-recovery',basis:'User confirmed in Neon Console that the configured endpoint is a separate child of production and authorized migration/regressions; user confirmed disposal/recreation from production.',fullBranchId:config.identity.branchId,branchIdRequiredForSqlConnection:false,recreation:'Create a replacement disposable child from the intact production parent via the already-used Console workflow. This recreates a testing dataset; it is not an exact-point production restore.',originalEndpointNeverSelected:true};
helper.save('authorization-and-recreation',authorization);
const environment={...config.environment,DATABASE_URL:config.direct.href,H10_TEST_DATABASE_URL:config.direct.href,NODE_ENV:'test'};
const expected=['20261017090000_h10_1_exit_clearance','20261017120000_h10_2_final_separation'];
async function run(name,args,env=environment){
  const started=performance.now();const child=spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b.toString());child.stderr.on('data',b=>stderr+=b.toString());
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  // Keep static test assertions/build summaries only; no raw SQL, error argument dumps or response bodies.
  const output=stdout+'\n'+stderr;
  const lines=output.split(/\r?\n/).filter(l=>/^(PASS \d+:|INTERFACE PASS|REGRESSION |H10\.|S1 SaaS|All migrations|Applying migration|The following migration|✓ |✔ |Error:|AssertionError)/.test(l)).map(l=>l.replace(/postgres(?:ql)?:\/\/\S+/gi,'[URL REDACTED]').replace(/[\w.+-]+@[\w.-]+/g,'[EMAIL REDACTED]')).filter(l=>!/(passwordHash|activationToken|salary:|baseRate:|netAmount:)/i.test(l));
  const result={name,exitCode:code,elapsedMs:Math.round(performance.now()-started),errorCodes:[...new Set(output.match(/\b(?:P\d{4}|EPERM|EACCES|ENOENT)\b/g)||[])],assertions:lines};
  helper.save(name,result);console.log(JSON.stringify({name,exitCode:code,elapsedMs:result.elapsedMs,errorCodes:result.errorCodes,assertionLines:lines.length}));
  helper.assertOriginalUnchanged(config);return result;
}
async function history(db){return db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name,started_at`;}
async function verify(db){
  const migrations=await history(db);
  const h10ChecksumMatch=expected.every(name=>{const text=fs.readFileSync('prisma/migrations/'+name+'/migration.sql','utf8');const hashes=[helper.digest(Buffer.from(text)),helper.digest(Buffer.from(text.replace(/\r\n/g,'\n'))),helper.digest(Buffer.from(text.replace(/\r?\n/g,'\r\n')))];return migrations.some(m=>m.migration_name===name&&m.finished&&!m.rolled_back&&hashes.includes(m.checksum));});
  const columns=await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
  const columnSet=new Set(columns.map(c=>c.table_name+'.'+c.column_name));
  const missingColumns=Prisma.dmmf.datamodel.models.flatMap(m=>m.fields.filter(f=>f.kind!=='object'&&!columnSet.has((m.dbName||m.name)+'.'+(f.dbName||f.name))).map(f=>(m.dbName||m.name)+'.'+(f.dbName||f.name)));
  const sql=expected.map(n=>fs.readFileSync('prisma/migrations/'+n+'/migration.sql','utf8')).join('\n');
  const names=[...sql.matchAll(/CREATE TRIGGER "([^"]+)"/g)].map(m=>m[1]);
  const triggers=await db.$queryRaw`SELECT t.tgname,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`;
  const missingTriggers=names.filter(n=>!triggers.some(t=>t.tgname===n&&t.tgenabled==='O'));
  const enums=await db.$queryRaw`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'`;
  const missingEnumValues=Prisma.dmmf.datamodel.enums.flatMap(e=>e.values.filter(v=>!enums.some(x=>x.typname===(e.dbName||e.name)&&x.enumlabel===(v.dbName||v.name))).map(v=>e.name+'.'+v.name));
  const triggerFunctions=await db.$queryRaw`SELECT proname,proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (proname LIKE 'Separation%' OR proname IN ('ProbationRecord_assert_separation_scope','Employee_guard_post_separation_work')) ORDER BY proname`;
  const constraints=await db.$queryRaw`SELECT conname,convalidated FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace JOIN pg_class r ON r.oid=c.conrelid WHERE n.nspname='public' AND r.relname IN ('EmployeeSeparationCase','EmployeeClearanceItem','EmployeeSeparationReview','EmployeeSeparationAudit','ProbationRecord')`;
  const criticalIndexes=await db.$queryRaw`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('User_id_organizationId_key','Employee_id_organizationId_key','ProbationRecord_closedBySeparationCaseId_idx','EmployeeSeparationCase_one_active_employee')`;
  const index=await db.$queryRaw`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='EmployeeSeparationCase_one_active_employee'`;
  const beforeFile=path.join(helper.directory,'protected-data-before.json');
  const before=JSON.parse(fs.readFileSync(beforeFile));
  const after=await helper.fingerprints(db,before.columns);
  const changedTables=before.tables.filter(t=>JSON.stringify(t)!==JSON.stringify(after.tables.find(a=>a.table===t.table))).map(t=>t.table);
  const result={capturedAt:new Date().toISOString(),identity:config.identity,appliedCount:migrations.filter(m=>m.finished&&!m.rolled_back).length,h10Applied:expected.every(n=>migrations.some(m=>m.migration_name===n&&m.finished&&!m.rolled_back)),h10ChecksumMatch,missingColumns,missingEnumValues,expectedTriggers:names.length,missingTriggers,triggerFunctions,constraints,criticalIndexes,index,protectedTablesCompared:before.tables.length,changedProtectedTables:changedTables,originalEnvUnchanged:true};
  helper.save('schema-and-history-verification',result);helper.save('protected-data-after',after);
  if(!result.h10Applied||!h10ChecksumMatch||result.missingColumns.length||missingEnumValues.length||result.missingTriggers.length||criticalIndexes.length!==4||constraints.some(c=>!c.convalidated)||changedTables.length||!index[0]?.indexdef.includes('APPROVED_PENDING_EFFECTIVE'))helper.fail('POST_MIGRATION_VERIFICATION_FAILED');
  console.log(JSON.stringify({verification:'PASS',appliedCount:result.appliedCount,missingColumns:0,enabledH10Triggers:names.length,protectedTablesUnchanged:before.tables.length}));return result;
}
async function main(){
  const db=mode==='build'?null:new PrismaClient({datasources:{db:{url:helper.readOnly(config.direct)}},log:[]});
  try {
    if(mode==='migrate'){
      const migrations=await history(db);
      if(migrations.some(m=>!m.finished&&!m.rolled_back))helper.fail('UNRESOLVED_MIGRATION');
      const dirs=fs.readdirSync('prisma/migrations',{withFileTypes:true}).filter(e=>e.isDirectory());
      const pending=[];
      for(const entry of dirs){const file='prisma/migrations/'+entry.name+'/migration.sql';if(!fs.existsSync(file))continue;const text=fs.readFileSync(file,'utf8');const hashes=[helper.digest(Buffer.from(text)),helper.digest(Buffer.from(text.replace(/\r\n/g,'\n'))),helper.digest(Buffer.from(text.replace(/\r?\n/g,'\r\n')))];const applied=migrations.filter(m=>m.migration_name===entry.name&&m.finished&&!m.rolled_back);if(applied.some(m=>!hashes.includes(m.checksum)))helper.fail('APPLIED_CHECKSUM_MISMATCH');if(!applied.length)pending.push(entry.name);}
      if(JSON.stringify(pending.sort())!==JSON.stringify(expected))helper.fail('UNEXPECTED_PENDING_MIGRATIONS');
      helper.save('protected-data-before',await helper.fingerprints(db));
      const result=await run('migration-deploy',['node_modules/prisma/build/index.js','migrate','deploy','--schema','prisma/schema.prisma']);
      if(result.exitCode!==0)helper.fail('MIGRATION_DEPLOY_FAILED');
      await verify(db);
    }else if(mode==='verify'){await verify(db);}
    else if(mode==='regressions'){
      const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
      if(!fs.existsSync(npmCli))helper.fail('NPM_CLI_NOT_FOUND');
      const quietEnv={...environment,NODE_OPTIONS:'--require '+path.resolve('scripts/performance-audit-preload.cjs')};
      const suites=[['h10-1','test:h10-1'],['h10-2','test:h10-2'],['isolated-regressions','test:h10-2','--','--regressions-only'],['h10-interface','test:h10-interface']];
      const results=[];
      for(const [name,...args] of suites){results.push(await run(name,[npmCli,'run',...args],quietEnv));}
      helper.save('regression-summary',results.map(({assertions,...r})=>r));await verify(db);
      if(results.some(r=>r.exitCode!==0))process.exitCode=1;
    }else if(mode==='build'){
      const buildEnv={...environment,NODE_ENV:'production',DATABASE_URL:helper.readOnly(config.pooled)};
      const commands=[['prisma-generate',['node_modules/prisma/build/index.js','generate']],['typescript',['node_modules/typescript/bin/tsc','--noEmit']],['production-build',['node_modules/next/dist/bin/next','build','--webpack']]];
      for(const [name,args]of commands){const result=await run(name,args,buildEnv);if(result.exitCode!==0){process.exitCode=1;break;}}
    }else if(mode==='activity'){
      const rows=await db.$queryRaw`SELECT state,wait_event_type,wait_event,count(*)::int AS connections,round(max(extract(epoch FROM clock_timestamp()-query_start)))::int AS oldest_query_seconds FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' GROUP BY state,wait_event_type,wait_event`;
      console.log(JSON.stringify(rows));
    }else helper.fail('UNKNOWN_MODE');
  }finally{helper.assertOriginalUnchanged(config);await db?.$disconnect();}
}
main().catch(e=>{console.error(JSON.stringify({code:e.code||e.name}));process.exitCode=1;});

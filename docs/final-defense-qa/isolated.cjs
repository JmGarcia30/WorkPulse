const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { profiles, offline, save, scrub } = require('./qa-runner.cjs');
const evidence = (process.env.WORKPULSE_QA_EVIDENCE_DIR || 'docs/final-defense-qa/evidence').replace(/\/$/, '') + '/';
fs.mkdirSync(evidence, { recursive: true });
async function main() {
  const expected = profiles['.env.recovery.local'];
  const target = new URL(expected.H10_TEST_DATABASE_URL);
  const protectedTarget = new URL(profiles['.env'].DATABASE_URL);
  if(target.hostname.replace('-pooler.','.')===protectedTarget.hostname.replace('-pooler.','.')) throw Error('PROTECTED_DATABASE');
  const read = new URL(target);read.searchParams.set('options','-c default_transaction_read_only=on');
  const reader = new PrismaClient({datasources:{db:{url:read.href}},log:[]});
  let identity;
  try { identity=(await reader.$queryRawUnsafe("SELECT current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('default_transaction_read_only') AS read_only"))[0]; } finally {await reader.$disconnect();}
  if(identity.read_only!=='on'||identity.branch_id!==expected.WORKPULSE_TEST_NEON_BRANCH_ID||identity.endpoint_id!==expected.WORKPULSE_TEST_NEON_ENDPOINT_ID)throw Error('LIVE_IDENTITY_MISMATCH');
  let manifest;
  if(process.argv[2]==='init') {
    const schema='batch3_test_'+randomBytes(12).toString('hex');
    const writer=new PrismaClient({datasources:{db:{url:target.href}},log:[]});
    try {
      const extension=await writer.$queryRawUnsafe("SELECT extname FROM pg_extension WHERE extname='btree_gist'");
      if(extension.length!==1)throw Error('EXTENSION_MISSING_NO_GLOBAL_CHANGES_ALLOWED');
      await writer.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');
    } finally {await writer.$disconnect();}
    manifest={createdAt:new Date().toISOString(),schema,identity,productionEndpointDistinct:true,syntheticOnly:true};
    save('isolation',manifest);
    target.searchParams.set('schema',schema);
    target.searchParams.set('options','-c search_path='+schema+',public');
    const r=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...offline,DATABASE_URL:target.href},encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:8*1024*1024});
    fs.writeFileSync(evidence+'ENV-007-migrations.log',scrub((r.stdout||'')+(r.stderr||'')));
    save('ENV-007-migrations',{exitCode:r.status,error:r.error?.code,status:r.status===0?'PASS':'FAIL',schema});
    console.log(JSON.stringify({schema,migrationsExit:r.status,error:r.error?.code}));
  } else if(process.argv[2]==='fresh') {
    const id=process.argv[3],args=process.argv.slice(4);
    const schema=(id.startsWith('SEC-002')||id.startsWith('SEC-003')||id.includes('staff-security')?'staff_auth_test_':'batch3_test_')+randomBytes(12).toString('hex');
    const control=new PrismaClient({datasources:{db:{url:target.href}},log:[]});
    try {await control.$executeRawUnsafe('CREATE SCHEMA "'+schema+'"');}finally{await control.$disconnect();}
    fs.appendFileSync(evidence+'owned-schemas.jsonl',JSON.stringify({schema,identity,createdAt:new Date().toISOString(),test:id})+'\n');
    target.searchParams.set('schema',schema);target.searchParams.set('options','-c search_path='+schema+',public');
    const env={...offline,NODE_ENV:'test',DATABASE_URL:target.href,H10_TEST_DATABASE_URL:target.href};
    if((id.startsWith('RFID-00')||id.includes('cookie'))&&fs.existsSync('.next/final-defense-qa-tls/cert.pem'))env.NODE_EXTRA_CA_CERTS=require('node:path').resolve('.next/final-defense-qa-tls/cert.pem');
    let migration;
    for(let attempt=0;attempt<8;attempt++) {
      migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024});
      if(migration.status===0||!String(migration.stderr).includes('P1002'))break;
    }
    fs.writeFileSync(evidence+id+'-migration.log',scrub((migration.stdout||'')+(migration.stderr||'')));
    if(migration.status!==0){save(id,{id,status:'BLOCKED',phase:'migration setup',schema,error:migration.error?.code,exitCode:migration.status});throw Error('FRESH_MIGRATION_FAILED '+scrub(migration.stderr||''));}
    const start=Date.now();
    const r=spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:16*1024*1024});
    fs.writeFileSync(evidence+id+'.log',scrub((r.stdout||'')+(r.stderr||'')));
    const result={id,command:'node '+args.join(' '),capturedAt:new Date().toISOString(),durationMs:Date.now()-start,exitCode:r.status,error:r.error?.code,status:r.status===0?'PASS':'FAIL',schema,isolatedPerSuite:true};save(id,result);console.log(JSON.stringify(result));
  } else {
    manifest=JSON.parse(fs.readFileSync(evidence+'isolation.json'));
    if(manifest.identity.branch_id!==identity.branch_id||!/^batch3_test_[a-f0-9]{24}$/.test(manifest.schema))throw Error('SCHEMA_MANIFEST_MISMATCH');
    target.searchParams.set('schema',manifest.schema);
    target.searchParams.set('options','-c search_path='+manifest.schema+',public');
    const id=process.argv[3],args=process.argv.slice(4);
    const start=Date.now();
    const r=spawnSync(process.execPath,args,{env:{...offline,NODE_ENV:'test',DATABASE_URL:target.href,H10_TEST_DATABASE_URL:target.href},encoding:'utf8',windowsHide:true,timeout:240000,maxBuffer:16*1024*1024});
    fs.writeFileSync(evidence+id+'.log',scrub((r.stdout||'')+(r.stderr||'')));
    const result={id,command:'node '+args.join(' '),capturedAt:new Date().toISOString(),durationMs:Date.now()-start,exitCode:r.status,error:r.error?.code,status:r.status===0?'PASS':'FAIL',schema:manifest.schema};save(id,result);console.log(JSON.stringify(result));
  }
}
main().catch(e=>{console.error(scrub(e.message));process.exitCode=1;});

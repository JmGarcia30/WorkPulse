const fs=require('node:fs'),assert=require('node:assert/strict');
const {PrismaClient}=require('@prisma/client');
const {profiles,save}=require('./qa-runner.cjs');
async function main(){
  const evidence='docs/final-defense-qa/evidence/';
  const initial=JSON.parse(fs.readFileSync(evidence+'isolation.json'));
  const owned=fs.readFileSync(evidence+'owned-schemas.jsonl','utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
  const expected=profiles['.env.recovery.local'];
  const url=new URL(expected.H10_TEST_DATABASE_URL),protectedUrl=new URL(profiles['.env'].DATABASE_URL);
  assert.notEqual(url.hostname.replace('-pooler.','.'),protectedUrl.hostname.replace('-pooler.','.'));
  const db=new PrismaClient({datasources:{db:{url:url.href}},log:[]});
  const results=[];
  try{
    const identity=(await db.$queryRawUnsafe("SELECT current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id"))[0];
    assert.equal(identity.branch_id,expected.WORKPULSE_TEST_NEON_BRANCH_ID);assert.equal(identity.endpoint_id,expected.WORKPULSE_TEST_NEON_ENDPOINT_ID);
    assert.equal(identity.branch_id,initial.identity.branch_id);
    for(const record of owned)assert.equal(record.identity.branch_id,identity.branch_id);
    for(const schema of new Set([initial.schema,...owned.map(r=>r.schema)])){
      assert.match(schema,/^(batch3_test_|staff_auth_test_)[a-f0-9]{24}$/);
      assert.notEqual(schema,'public');
      await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');
      const remaining=await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1',schema);
      assert.equal(remaining.length,0);results.push({schema,removed:true});
    }
    save('cleanup',{capturedAt:new Date().toISOString(),identity,productionTargetExcluded:true,onlyManifestOwnedSchemas:true,schemas:results,status:'PASS'});
    console.log(JSON.stringify({status:'PASS',schemasRemoved:results.length}));
  }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e.code||e.name);process.exitCode=1;});

const path=require('node:path'),fs=require('node:fs');
process.env.WORKPULSE_QA_EVIDENCE_DIR='docs/final-defense-qa/release-blockers/evidence';
const qa=require('../qa-runner.cjs');
const root=path.resolve(__dirname,'evidence');fs.mkdirSync(root,{recursive:true});
const identity={project:'late-block-61364102',branch:'br-odd-field-azce2cjf',endpoint:'ep-patient-cake-az9urbbj',parent:'br-hidden-violet-azjl3vam',parentLsn:'0/16544B40',snapshotTimestamp:'2026-11-02T07:08:51Z'};
function connection(schema='public'){const url=new URL(qa.profiles['.env'].DATABASE_URL);url.hostname='ep-patient-cake-az9urbbj.c-3.ap-southeast-1.aws.neon.tech';url.searchParams.set('schema',schema);url.searchParams.set('options','-c search_path='+schema+',public');if(url.hostname===new URL(qa.profiles['.env'].DATABASE_URL).hostname)throw Error('PRODUCTION_ENDPOINT');return url.href;}
function environment(schema='public'){return {...qa.offline,NODE_ENV:'test',DATABASE_URL:connection(schema),H10_TEST_DATABASE_URL:connection(schema),WORKPULSE_QA_EVIDENCE_DIR:qa.offline.WORKPULSE_QA_EVIDENCE_DIR};}
async function verify(db){const [live]=await db.$queryRawUnsafe("SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id");if(live.branch_id!==identity.branch||live.endpoint_id!==identity.endpoint||live.database!=='neondb')throw Error('LIVE_IDENTITY_MISMATCH');return live;}
module.exports={...qa,root,identity,connection,environment,verify};

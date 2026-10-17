// Matches package.json build steps; DB sessions are read-only, no migration commands.
const fs = require('node:fs');
const { spawn } = require('node:child_process');
if(fs.existsSync('.env')) process.loadEnvFile('.env');
const directory='docs/performance-audit/batch-0';
fs.mkdirSync(directory,{recursive:true});
const url=new URL(process.env.DATABASE_URL);
url.searchParams.set('options',`${url.searchParams.get('options')||''} -c default_transaction_read_only=on`.trim());
const environment={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',DATABASE_URL:url.toString()};
const results=[];
async function run(name,args) {
  const start=performance.now();
  const child=spawn(process.execPath,args,{env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output+=b.toString();});
  const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  output=output.replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_DATABASE_URL]');
  fs.writeFileSync(`${directory}/${name}.txt`,output);
  const result={name,code,elapsedMs:Math.round(performance.now()-start)};
  results.push(result);fs.writeFileSync(`${directory}/build-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(result));
  if(code!==0)process.exitCode=1;
  return code;
}
async function main(){
  if(await run('prisma-validate',['node_modules/prisma/build/index.js','validate'])!==0)return;
  if(await run('prisma-generate',['node_modules/prisma/build/index.js','generate'])!==0)return;
  await run('production-build',['node_modules/next/dist/bin/next','build','--webpack']);
}
main().catch(error=>{console.error(JSON.stringify({code:error.code||error.name}));process.exitCode=1;});

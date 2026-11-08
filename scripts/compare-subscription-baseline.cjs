/* eslint-disable @typescript-eslint/no-require-imports -- Comparison runs in a detached main checkout against the owned non-production subscription schema. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util'),{spawn}=require('node:child_process');
const root=process.cwd(),baseline=path.join(root,'.next/subscription-main-baseline'),directory='docs/subscriptions/verification';
assert(fs.existsSync(path.join(baseline,'.git')));
const profile=parseEnv(fs.readFileSync('.env.subscriptions-test.local','utf8'));
assert.match(new URL(profile.DATABASE_URL).searchParams.get('schema')||'',/^subscription_test_[a-f0-9]{24}$/);
const results=[];
async function run(name,args){
  const child=spawn(process.execPath,args,{cwd:baseline,env:{...process.env,...profile,NODE_ENV:'test',NODE_OPTIONS:'--require '+path.join(root,'scripts/subscription-test-preload.cjs'),TSX_TSCONFIG_PATH:path.join(baseline,'tsconfig.json'),VERCEL:'0',VERCEL_ENV:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  const exitCode=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});
  fs.writeFileSync(`${directory}/baseline-${name}.log`,output.replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));
  results.push({name,exitCode});console.log(JSON.stringify({name,exitCode}));
}
async function main(){
  for(const script of ['test-h1-employee-core.ts','test-h2-employment-probation.ts','test-h6-payroll-foundation.ts','test-final-ux-hiring.cjs'])await run(script.replace(/\.(ts|cjs)$/,''),[path.join(root,'node_modules/tsx/dist/cli.mjs'),'scripts/'+script]);
  await run('eslint',[path.join(root,'node_modules/eslint/bin/eslint.js'),'.']);
  fs.writeFileSync(`${directory}/main-baseline.json`,JSON.stringify({ref:'origin/main',commit:'0d7657b22dc6ebb34855f0a554f92cf9c95c6f73',sameIsolatedDatabase:true,results},null,2));
}
main().catch(error=>{console.error(error.code||error.name);process.exitCode=1;});

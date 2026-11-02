const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {profiles}=require('./qa-runner.cjs');
const root=path.resolve('docs/final-defense-qa'),files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())walk(p);else files.push(p);}}
walk(root);
const missing=[];
for(const name of ['REPORT.md','TEST-RESULTS.md','BUGS.md','DEMO-READINESS.md']){
  const file=path.join(root,name);assert(fs.existsSync(file));
  const text=fs.readFileSync(file,'utf8');
  for(const m of text.matchAll(/\]\(([^)]+)\)/g))if(!/^https?:\/\//.test(m[1])&&!fs.existsSync(path.resolve(path.dirname(file),m[1].split('#')[0])))missing.push({file:name,link:m[1]});
}
const secrets=Object.values(profiles).flatMap(p=>Object.entries(p).filter(([k,v])=>/SECRET|TOKEN|PASSWORD|KEY|GMAIL_USER|EMAIL_FROM|DATABASE_URL/.test(k)&&v.length>=12).map(([,v])=>v));
const leaks=[];
for(const file of files.filter(f=>/\.(md|json|jsonl|log)$/.test(f))){const text=fs.readFileSync(file,'utf8');if(secrets.some(s=>text.includes(s)))leaks.push(path.relative(root,file));}
const result={capturedAt:new Date().toISOString(),reportCount:4,filesInspected:files.length,missingLinks:missing,configuredSecretLeaks:leaks,status:missing.length||leaks.length?'FAIL':'PASS'};
fs.writeFileSync(path.join(root,'evidence/deliverable-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(result.status==='FAIL')process.exitCode=1;

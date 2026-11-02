const fs=require('node:fs'),path=require('node:path');
const report=path.resolve('docs/final-defense-qa/IT-EVAL-READINESS.md'),body=fs.readFileSync(report,'utf8');
const missing=[];let count=0;
for(let offset=0;(offset=body.indexOf('](',offset))!==-1;){let cursor=offset+2,depth=1;for(;cursor<body.length&&depth;cursor++){if(body[cursor]==='(')depth++;if(body[cursor]===')')depth--;}const link=body.slice(offset+2,cursor-1);offset=cursor;count++;if(!/^https?:\/\//.test(link)&&!fs.existsSync(path.resolve(path.dirname(report),link)))missing.push(link);}
const {profiles}=require('../qa-runner.cjs');
const secrets=Object.values(profiles).flatMap(p=>Object.entries(p).filter(([k,v])=>/SECRET|TOKEN|PASSWORD|KEY|GMAIL_USER|EMAIL_FROM|DATABASE_URL/.test(k)&&v.length>=12).map(([,v])=>v));
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(/\.(json|jsonl|log|md|cjs)$/.test(file))files.push(file);}}walk(__dirname);files.push(report);
const leaks=files.filter(file=>{const s=fs.readFileSync(file,'utf8');return secrets.some(secret=>s.includes(secret));});
const result={capturedAt:new Date().toISOString(),status:missing.length||leaks.length?'FAIL':'PASS',linksChecked:count,missingLinks:missing,configuredSecretLeaks:leaks,filesScanned:files.length};fs.writeFileSync(path.join(__dirname,'evidence/report-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;

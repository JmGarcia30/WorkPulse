const fs=require('node:fs'),{execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const out='docs/final-defense-qa/evidence/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const before=JSON.parse(fs.readFileSync(out+'environment.json'));
const environment=Object.entries(before.protectedHashes).map(([file,sha256])=>({file,unchanged:hash(fs.readFileSync(file))===sha256}));
const restored=[];
for(const file of ['docs/rfid/integration-audit/rules-regression.json','docs/payroll-phase-3/unpaid-leave-probe.json']) {
  const original=execFileSync('git',['show','HEAD:'+file]);
  const current=fs.readFileSync(file);
  const normalized=Buffer.from(current.toString('utf8').replace(/\r\n/g,'\n'));
  if(hash(original)!==hash(normalized)) {
    fs.writeFileSync(out+'generated-'+file.split('/').at(-1),current);
    restored.push(file);
  }
  const checkout=Buffer.from(original.toString('utf8').replace(/\r?\n/g,'\r\n'));
  if(hash(checkout)!==hash(current))fs.writeFileSync(file,checkout);
}
const results=fs.readdirSync(out).filter(f=>f.endsWith('.json')).flatMap(file=>{try{const r=JSON.parse(fs.readFileSync(out+file));return r.id&&r.command?[{...r,evidence:file}]:[];}catch{return [];}});
const restoredArtifacts=['docs/rfid/integration-audit/rules-regression.json','docs/payroll-phase-3/unpaid-leave-probe.json'].filter(file=>fs.existsSync(out+'generated-'+file.split('/').at(-1)));
const summary={capturedAt:new Date().toISOString(),testedCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),remoteMain:execFileSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).trim(),environment,restoredHistoricalReportArtifacts:restoredArtifacts,results};
fs.writeFileSync(out+'execution-index.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({environment,suites:results.length,trackedChanges:execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim()}));

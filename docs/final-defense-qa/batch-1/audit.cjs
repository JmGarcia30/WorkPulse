const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const directory='docs/final-defense-qa/batch-1/';
const digest=data=>createHash('sha256').update(data).digest('hex');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(file=>file&&fs.existsSync(file));
const hashes=Object.fromEntries(files.map(file=>[file,digest(fs.readFileSync(file))]));
const environment=Object.fromEntries(['.env','.env.recovery.local','workpulse-rehearsal.env'].filter(file=>fs.existsSync(file)).map(file=>[file,digest(fs.readFileSync(file))]));
const snapshot={capturedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes,environment};
if(process.argv[2]==='before')fs.writeFileSync(directory+'baseline.json',JSON.stringify(snapshot,null,2)+'\n');
else {
  const before=JSON.parse(fs.readFileSync(directory+'baseline.json'));
  const changes=files.filter(file=>hashes[file]!==before.hashes[file]);
  const result={capturedAt:snapshot.capturedAt,commitUnchanged:before.commit===snapshot.commit,trackedChanges:changes,environmentUnchanged:Object.entries(before.environment).every(([file,value])=>environment[file]===value),onlyExpectedFilesChanged:changes.every(file=>['src/features/hiring/actions.ts','src/lib/auth/session.ts','scripts/test-staff-session-security.cjs'].includes(file))};
  fs.writeFileSync(directory+'preservation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
  if(!result.commitUnchanged||!result.environmentUnchanged||!result.onlyExpectedFilesChanged)process.exitCode=1;
}

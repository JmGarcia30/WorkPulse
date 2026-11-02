// Run the existing offline checks with output redirected; preserve all IT Evaluation evidence.
process.argv.splice(2,0,'docs/final-defense-qa/it-eval/checks.cjs');
process.env.DATABASE_URL='postgresql://qa:qa@127.0.0.1:1/qa';
// Adapter is unnecessary for offline checks; redirect only their known output directory.
const fs=require('node:fs'),path=require('node:path'),write=fs.writeFileSync.bind(fs);const out=path.resolve(__dirname,'evidence');fs.mkdirSync(out,{recursive:true});fs.writeFileSync=(file,...args)=>{const relative=path.relative(path.resolve('docs/final-defense-qa/it-eval/evidence'),file);if(!relative.startsWith('..')&&!path.isAbsolute(relative)){file=path.join(out,relative);fs.mkdirSync(path.dirname(file),{recursive:true});}return write(file,...args);};
process.argv.splice(2,1);require('../it-eval/checks.cjs');

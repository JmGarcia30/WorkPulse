/* eslint-disable @typescript-eslint/no-require-imports -- Preserve existing regression evidence while reusing the original test suites. */
const fs=require('node:fs'),path=require('node:path');
const originalWrite=fs.writeFileSync;
const root=path.resolve('docs/final-plan-release/verification/regression-output');
fs.writeFileSync=function(file,...args){
  if(typeof file==='string'){
    const relative=path.relative(path.resolve('docs'),path.resolve(file));
    if(relative&&!relative.startsWith('..')&&!relative.startsWith('final-plan-release'+path.sep)){
      file=path.join(root,relative);fs.mkdirSync(path.dirname(file),{recursive:true});
    }
  }
  return originalWrite.call(this,file,...args);
};
require('./subscription-test-preload.cjs');

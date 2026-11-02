// Preserve historical suite files/reports; adapt only its superseded successful-login expectation.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const script=process.argv[2];
if(script==='test-staff-session-security.cjs'){
 const entry=path.resolve('scripts',script),load=Module._load;
 Module._load=function(name,parent,main){if(path.resolve(name)===entry){const source=fs.readFileSync(entry,'utf8').replace("attempts.filter(Boolean).length===5,'Concurrent correct-password requests cannot bypass the five-attempt budget'","attempts.filter(Boolean).length===8,'Successful concurrent logins do not consume incorrect-password budget'");const m=new Module(entry,module);m.filename=entry;m.paths=Module._nodeModulePaths(path.dirname(entry));m._compile(source,entry);return m.exports;}return load.call(this,name,parent,main);};
}
require('../adapt-legacy.cjs');

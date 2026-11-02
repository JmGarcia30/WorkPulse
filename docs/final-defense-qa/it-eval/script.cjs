const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema'),/^batch3_test_[a-f0-9]{24}$/);
require('tsx/cjs');const load=Module._load,write=fs.writeFileSync.bind(fs),mkdir=fs.mkdirSync.bind(fs);
fs.writeFileSync=(file,...args)=>{if(String(file).replaceAll('\\','/').startsWith('docs/')&&!String(file).replaceAll('\\','/').startsWith('docs/final-defense-qa/')){file=path.join(__dirname,'evidence/legacy',file);mkdir(path.dirname(file),{recursive:true});}return write(file,...args);};
Module._load=function(name,parent,main){if(name==='server-only')return {};if(name.startsWith('@/'))return load.call(this,path.resolve('src',name.slice(2)),parent,main);return load.call(this,name,parent,main);};
require(path.resolve('scripts',process.argv[2]));

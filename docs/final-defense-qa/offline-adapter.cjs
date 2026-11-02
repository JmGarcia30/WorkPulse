const path=require('node:path'),Module=require('node:module');
process.env.NODE_ENV='production';
require('tsx/cjs');
const original=Module._load;
Module._load=function(name,parent,main){
  if(name==='server-only')return {};
  if(name==='next/font/google')return {Poppins:()=>({className:'qa-font',variable:'--qa-font'})};
  return original.call(this,name,parent,main);
};
require(path.resolve('scripts',process.argv[2]));

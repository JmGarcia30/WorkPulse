const Module = require('node:module');
const original = Module._load;
Module._load = function(name,parent,main) {
  if(name==='server-only')return {};
  return original.call(this,name,parent,main);
};

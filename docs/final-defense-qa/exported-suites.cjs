const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
require('tsx/cjs');
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({log:[]});
let activeDb=db;
const prismaProxy=new Proxy({}, {get:(_,key)=>{const value=activeDb[key];return typeof value==='function'?value.bind(activeDb):value;}});
assert.match(new URL(process.env.DATABASE_URL).searchParams.get('schema'),/^batch3_test_[a-f0-9]{24}$/);
const context = { headers:new Headers({host:'localhost:3000'}),jar:new Map() };
const original = Module._load;
Module._load = function(name,parent,main) {
  if(name==='server-only')return {};
  if(name==='next/headers')return {headers:async()=>context.headers,cookies:async()=>({get:key=>context.jar.get(key),has:key=>context.jar.has(key),set:(key,value,options)=>{if(options?.maxAge===0||(options?.expires&&options.expires<=new Date()))context.jar.delete(key);else context.jar.set(key,{value,...options});},delete:key=>context.jar.delete(key)})};
  if(name==='next/navigation')return {redirect:url=>{throw Error('REDIRECT:'+url);},notFound:()=>{throw Error('NOT_FOUND');}};
  if(name==='next/cache')return {revalidatePath:()=>{}};
  if(name==='@/lib/db/prisma')return {prisma:prismaProxy};
  if(name.startsWith('@/'))return original.call(this,path.resolve('src',name.slice(2)),parent,main);
  return original.call(this,name,parent,main);
};
async function main() {
  process.env.PLATFORM_ROOT_DOMAIN='localhost:3000';process.env.PLATFORM_PUBLIC_ORIGIN='http://localhost:3000';
  const file=process.argv[2];
  if(file.includes('routing')||file.includes('platform-admin')||file.includes('company-registration'))await db.organization.upsert({where:{slug:'st-aloysius'},create:{name:'Synthetic SAGA QA only',slug:'st-aloysius',timeZone:'Asia/Manila'},update:{}});
  const fn=require(path.resolve('scripts',file));
  let result;
  if(file==='test-company-registration.cjs') {
    const rollback=Symbol('QA registration rollback');
    try {await db.$transaction(async tx=>{activeDb=new Proxy(tx,{get:(target,key)=>key==='$transaction'?callback=>callback(activeDb):Reflect.get(target,key)});result=await fn(activeDb,context);throw rollback;},{timeout:180000});}catch(e){if(e!==rollback)throw e;}
    activeDb=db;
  } else result=await (typeof fn==='function'?fn(db,context):fn[process.argv[3]](db));
  console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{Module._load=original;await db.$disconnect();});

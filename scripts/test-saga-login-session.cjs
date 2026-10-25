/* eslint-disable @typescript-eslint/no-require-imports -- HR-only authentication regression with actual modules and in-memory request/database dependencies. */
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
require('tsx/cjs');
process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = randomBytes(48).toString('hex');
const original = Module._load, jar = new Map(), checks = [];
let tenant = { organizationId: 'fixture-saga' }, user;
const db = { user: {
  findFirst: async ({ where }) => user?.email === where.email && user.organizationId === where.organizationId ? user : null,
  findUnique: async ({ where }) => user?.id === where.id ? user : null,
} };
require('./staff-auth-test-double.cjs')(db);
Module._load = function(name,parent,main) {
  if (name === 'server-only') return {};
  if (name === 'next/headers') return { cookies: async () => ({ get:key => jar.get(key),set:(key,value,options) => jar.set(key,{value,...options}),delete:key => jar.delete(key) }) };
  if (name === 'next/navigation') return { redirect:url => { throw Error('REDIRECT:' + url); } };
  if (name === '@/lib/db/prisma') return { prisma:db };
  if (name === '@/lib/tenant/server') return { resolveRequestTenant:async () => tenant,requireRequestTenant:async () => tenant,requestWorkspacePath:async pathname => '/saga' + pathname };
  if (name.startsWith('@/')) return original.call(this,path.resolve('src',name.slice(2)),parent,main);
  return original.call(this,name,parent,main);
};
const ok = (value,label) => { assert.ok(value,label);checks.push(label); };
async function main() {
  const password = randomBytes(18).toString('hex');
  user = { id:'fixture-hr',organizationId:'fixture-saga',role:'HR_ADMIN',email:'hr@fixture.invalid',name:'Fixture HR',passwordHash:await hash(password,4) };
  const actions = require('../src/lib/auth/actions.ts'), session = require('../src/lib/auth/session.ts');
  const guards = require('../src/lib/auth/guards.ts');
  const form = (email = user.email, value = password) => { const f = new FormData();f.set('email',email);f.set('password',value);return f; };
  ok(!!(await actions.loginAction(form(user.email,'wrong'))).error && !jar.has(session.COOKIE_NAME),'Wrong HR password creates no session');
  ok(!!(await actions.loginAction(form('foreign@fixture.invalid'))).error,'Foreign identity cannot log into SAGA');
  await assert.rejects(() => actions.loginAction(form()),{message:'REDIRECT:/saga/dashboard'});ok(true,'HR_ADMIN normal password login preserves SAGA dashboard redirect');
  ok((await guards.requireBackOfficeContext()).role === 'HR_ADMIN','Current HR_ADMIN session grants HR back-office permission');
  const cookie = jar.get(session.COOKIE_NAME);
  ok(cookie.httpOnly && cookie.secure && cookie.path === '/' && !cookie.domain,'HR session has production host-only cookie attributes');
  tenant = {organizationId:'fixture-foreign'};ok(await session.getSession() === null,'Valid SAGA HR JWT is rejected in a different tenant');tenant = {organizationId:'fixture-saga'};
  user.role = 'EMPLOYEE';ok(await session.getSession() === null,'HR role change invalidates previous session');user.role = 'HR_ADMIN';
  await assert.rejects(() => actions.logoutAction(),{message:'REDIRECT:/saga/login'});ok(await session.getSession() === null && !jar.has(session.COOKIE_NAME),'HR logout deletes browser session and preserves SAGA login redirect');
  const result = {capturedAt:new Date().toISOString(),passed:true,assertions:checks.length,scope:'Actual HR_ADMIN action/session/guard modules; in-memory dependencies',databaseConnections:0,checks};
  fs.mkdirSync('docs/auth-security',{recursive:true});fs.writeFileSync('docs/auth-security/hr-session-tests.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({passed:true,assertions:checks.length,databaseConnections:0}));
}
main().catch(error => {console.error(JSON.stringify({passed:false,type:error.name,message:error.message.slice(0,200)}));process.exitCode=1;}).finally(() => {Module._load=original;});

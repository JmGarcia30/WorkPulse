/* eslint-disable @typescript-eslint/no-require-imports -- Database-free regression for the development Prisma singleton. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Prisma, PrismaClient } = require('@prisma/client');

async function main() {
  const filename = path.resolve('src/lib/db/prisma.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  }).outputText;
  const previousCache = globalThis.prisma;
  const previousEnvironment = process.env.NODE_ENV;
  const clients = [];
  let allocations = 0, checks = 0;
  class TrackedClient extends PrismaClient {
    constructor(options) { super(options); clients.push(this); allocations++; }
  }
  function loadSingleton() {
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded.require = function(name) {
      if (name === '@prisma/client') return { PrismaClient: TrackedClient };
      return Module.prototype.require.call(this, name);
    };
    loaded._compile(compiled, filename);
    return loaded.exports.prisma;
  }
  function check(value, label) { assert.ok(value, label); checks++; console.log('PASS:', label); }
  function delegatesExist(client) {
    return typeof client.organizationEmailIntegration?.findUnique === 'function' &&
      typeof client.organizationEmailOAuthAttempt?.findUnique === 'function' &&
      typeof client.hrEmailDelivery?.findUnique === 'function' &&
      typeof client.employeeFinalPay?.findUnique === 'function' &&
      typeof client.employeeFinalPayPayment?.findUnique === 'function' &&
      typeof client.employeeFinalPayAudit?.findUnique === 'function';
  }
  try {
    process.env.NODE_ENV = 'development';
    const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
    for (const name of ['OrganizationEmailIntegration', 'OrganizationEmailOAuthAttempt', 'HrEmailDelivery', 'EmployeeFinalPay', 'EmployeeFinalPayPayment', 'EmployeeFinalPayAudit']) {
      check(schema.includes('model ' + name + ' {') && Prisma.dmmf.datamodel.models.some(model => model.name === name), name + ' exists in schema and generated client');
    }
    globalThis.prisma = { user: {} }; // Client cached before either email model existed.
    const legacy = globalThis.prisma;
    const replacement = loadSingleton();
    check(replacement !== legacy && delegatesExist(replacement), 'Stale cached client is replaced with usable email delegates');
    check(globalThis.prisma === replacement, 'Replacement is cached for subsequent development requests');
    const beforeReload = allocations;
    check(loadSingleton() === replacement && allocations === beforeReload, 'Compatible client survives module reload without another allocation');
    globalThis.prisma = { organizationEmailIntegration: replacement.organizationEmailIntegration };
    check(delegatesExist(loadSingleton()), 'Cache missing the OAuth-attempt delegate is also replaced');
    globalThis.prisma = { organizationEmailIntegration: replacement.organizationEmailIntegration, organizationEmailOAuthAttempt: replacement.organizationEmailOAuthAttempt };
    check(delegatesExist(loadSingleton()), 'Cache predating durable HR email delivery is replaced');
    globalThis.prisma = { organizationEmailIntegration: replacement.organizationEmailIntegration, organizationEmailOAuthAttempt: replacement.organizationEmailOAuthAttempt, hrEmailDelivery: replacement.hrEmailDelivery };
    check(delegatesExist(loadSingleton()), 'Cache predating Final Pay delegates is replaced');
    globalThis.prisma = undefined;
    check(delegatesExist(loadSingleton()), 'Cold startup uses the current generated client');
    console.log(`${checks} checks passed; no database queries or writes.`);
  } finally {
    if (previousCache === undefined) delete globalThis.prisma; else globalThis.prisma = previousCache;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment;
    await Promise.all(clients.map(client => client.$disconnect()));
  }
}
main().catch(error => { console.error(error.code || error.name, error instanceof assert.AssertionError ? error.message : 'PRISMA_CACHE_CHECK_FAILED'); process.exitCode = 1; });

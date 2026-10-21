/* eslint-disable @typescript-eslint/no-require-imports -- Adapt existing fixtures to no-DDL rollback testing. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || !verified.h10ChecksumMatch || verified.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_TARGET');
Object.assign(process.env, config.environment, { DATABASE_URL: config.direct.href, H10_TEST_DATABASE_URL: config.direct.href, NODE_ENV: 'test' });
require('tsx/cjs');
const mode = process.argv[2];
if (!['h1', 'h2', 'h3', 'h10-1', 'h10-2'].includes(mode)) throw Error('UNKNOWN_SUITE');
const files = { h1: 'test-h1-employee-core.ts', h2: 'test-h2-employment-probation.ts', h3: 'test-h3-attendance.ts', 'h10-1': 'test-h10-1-separation.ts', 'h10-2': 'test-h10-2-separation.ts' };
const filename = path.resolve('scripts', files[mode]);
let source = fs.readFileSync(filename, 'utf8');
const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
const edits = [];
const skipped = [];
// Cleanup belongs to the outer rollback. Never run stale-fixture deletion or
// DDL bootstraps from legacy runners in the existing recovery schema.
const main = sourceFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'main');
for (const statement of main.body.statements) {
  if (ts.isTryStatement(statement) && statement.finallyBlock) edits.push({ start: statement.finallyBlock.getStart() + 1, end: statement.finallyBlock.end - 1, text: ' /* outer rollback owns fixture cleanup */ ' });
  if (mode === 'h1' && ((ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => d.name.getText() === 'staleOrganizations')) || (ts.isForOfStatement(statement) && statement.expression.getText() === 'staleOrganizations'))) edits.push({ start: statement.getStart(), end: statement.end, text: '' });
  if (mode === 'h3' && ts.isExpressionStatement(statement) && statement.getText().includes('H3 requires a disposable Batch 3 schema')) edits.push({ start: statement.getStart(), end: statement.end, text: '/* verified recovery + outer rollback replaces private-schema ownership */' });
}
if (mode.startsWith('h10')) {
  const integration = sourceFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'integration');
  const statements = integration.body.statements;
  for (let index = 0; index < statements.length; index++) {
    const statement = statements[index];
    if (mode === 'h10-1' && statement.getText().includes('TRUNCATE TABLE')) {
      edits.push({ start: statement.getStart(), end: statements[index + 1].end, text: '/* destructive TRUNCATE rejection test excluded by no-DDL/data safety constraints */' });
      skipped.push('Native TRUNCATE rejection assertion');
    }
    if (statement.getText().includes('CREATE FUNCTION') && statement.getText().includes('fail_audit')) {
      edits.push({ start: statement.getStart(), end: statement.end, text: 'globalThis.__functionalAuditFailure = true;' });
      skipped.push('Database-trigger fault injection replaced by client-boundary audit-write failure injection');
    }
    if (statement.getText().includes('CREATE TRIGGER') && statement.getText().includes('fail_audit')) edits.push({ start: statement.getStart(), end: statement.end, text: '/* client-side fault injection is armed; no trigger created */' });
    if (statement.getText().includes('DROP TRIGGER') && statement.getText().includes('fail_audit')) edits.push({ start: statement.getStart(), end: statement.end, text: 'globalThis.__functionalAuditFailure = false;' });
    if (mode === 'h10-2' && ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => d.name.getText() === 'workRacePerson')) {
      const end = statements.findIndex((node, position) => position > index && ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText() === 'backdatedPerson'));
      edits.push({ start: statement.getStart(), end: statements[end].getStart(), text: '/* real two-transaction employee lock race cannot run inside one rollback transaction */\n' });
      skipped.push('Real concurrent attendance-writer/separation execution lock race');
    }
  }
}
for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
source = source.replace(/\nmain\(\)[\s\S]*$/, mode.startsWith('h10') ? '\nmodule.exports = { integration, domainChecks: typeof domainChecks === "function" ? domainChecks : null, count: () => checks };' : '\nglobalThis.__functionalFixture = main();');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const rollback = Error('ROLLBACK');
const marker = 'fr-adapt-' + randomBytes(8).toString('hex');
let completed = false, testChecks;
async function run() {
  try {
    await db.$transaction(async tx => {
      let queue = Promise.resolve(), sequence = 0;
      const serial = operation => { const result = queue.then(operation); queue = result.catch(() => {}); return result; };
      const auditTx = new Proxy(tx, { get(target, key) {
        if (key === 'employeeSeparationAudit') return new Proxy(target.employeeSeparationAudit, { get(model, operation) {
          const method = Reflect.get(model, operation);
          if (operation === 'create') return args => {
            if (globalThis.__functionalAuditFailure && (args.data.action === 'SEPARATION_COMPLETED' || args.data.newValues?.reason === 'H10_FORCE_AUDIT_FAILURE')) throw Error('Forced audit failure');
            return method.call(model, args);
          };
          return typeof method === 'function' ? method.bind(model) : method;
        } });
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      async function protectedUnit(operation) {
        const name = 'functional_' + (++sequence);
        await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
      }
      const client = new Proxy(tx, { get(target, key) {
        if (key === '$disconnect') return async () => {};
        if (key === '$transaction') return operation => serial(() => protectedUnit(() => typeof operation === 'function' ? operation(auditTx) : Promise.all(operation)));
        const value = Reflect.get(target, key);
        if (typeof value === 'function') return (...args) => {
          const sql = typeof args[0] === 'string' ? args[0] : args[0]?.sql || args[0]?.strings?.join(' ');
          if (sql && /\b(CREATE|ALTER|DROP|TRUNCATE)\b/i.test(sql)) throw Error('DDL_FORBIDDEN');
          return serial(() => protectedUnit(() => value.apply(target, args)));
        };
        if (value && typeof value === 'object' && !String(key).startsWith('_')) return new Proxy(value, { get(model, operation) {
          const method = Reflect.get(model, operation);
          if (typeof method !== 'function') return method;
          return args => serial(() => protectedUnit(async () => {
            if (key === 'organization' && operation === 'create' && mode.startsWith('h10')) {
              if (args.data.slug === 'st-aloysius') return tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
              args = { ...args, data: { ...args.data, slug: marker + '-' + args.data.slug } };
            }
            return method.call(model, args);
          }));
        } });
        return value;
      } });
      globalThis.prisma = client;
      const fixtureModule = new Module(filename, require.main); fixtureModule.filename = filename; fixtureModule.paths = Module._nodeModulePaths(path.dirname(filename));
      fixtureModule._compile(code, filename);
      if (mode.startsWith('h10')) { fixtureModule.exports.domainChecks?.(); await fixtureModule.exports.integration(client); testChecks = fixtureModule.exports.count(); }
      else await globalThis.__functionalFixture;
      completed = true;
      throw rollback;
    }, { timeout: 600000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally {
    delete globalThis.prisma; delete globalThis.__functionalFixture; delete globalThis.__functionalAuditFailure;
    await db.$disconnect(); helper.assertOriginalUnchanged(config);
    const result = { suite: mode, completed, checks: testChecks, skipped, originalSourceEditedOnDisk: false, fixtureCleanup: 'outer transaction rolled back', ddlExecuted: false, realCommitAndConcurrentTransactionCoverage: false, adaptation: ['legacy cleanup/bootstrap replaced by rollback ownership', 'nested transactions use serialized savepoints', ...(mode.startsWith('h10') ? ['SAGA organization reused read-only; new fixture records only'] : [])] };
    fs.writeFileSync(`docs/functional-regression/adapted-${mode}.json`, JSON.stringify(result, null, 2));
  }
  console.log(`FR ${mode}: existing fixture assertions pass under no-DDL rollback adapter; true concurrent commits NOT covered.`);
}
run().catch(error => { console.error('FR FAILURE ' + JSON.stringify({ name: error.name, code: error.code, message: String(error.message).split(/\r?\n/).slice(-4).join(' ').replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]') })); process.exitCode = 1; });

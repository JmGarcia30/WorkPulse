/* eslint-disable @typescript-eslint/no-require-imports -- Disposable rollback fixtures, no schema changes. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const directory = 'docs/ui-batch1'; fs.mkdirSync(directory, { recursive: true });
const save = (name, data) => fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify(data, null, 2));
const mode = process.argv[2];
if (mode === 'snapshot') {
  const records = execFileSync('git', ['status', '--porcelain=v1', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = records.map(row => row.slice(3)).filter(file => !file.startsWith('.impeccable/') && !file.startsWith(directory) && !['scripts/ui-batch1.cjs', 'scripts/test-ui-batch1-browser.cjs'].includes(file) && fs.existsSync(file));
  const hashes = {};
  function remember(file) { if (fs.statSync(file).isDirectory()) for (const child of fs.readdirSync(file)) remember(file + '/' + child); else hashes[file] = createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
  files.forEach(remember); save('preserved-work', { priorImpeccableChanges: records.filter(row => row.slice(3).startsWith('.impeccable/')).length, hashes });
  console.log(JSON.stringify({ preservedFiles: Object.keys(hashes).length }));
} else if (mode === 'preservation') {
  const before = JSON.parse(fs.readFileSync(`${directory}/preserved-work.json`));
  const changed = Object.entries(before.hashes).filter(([file, hash]) => !fs.existsSync(file) || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== hash).map(([file]) => file);
  save('preservation', { checked: Object.keys(before.hashes).length, changed }); if (changed.length) throw Error('PRIOR_WORK_CHANGED'); console.log('PASS prior uncommitted work preserved');
} else if (mode === 'integrity') {
  let source = fs.readFileSync('scripts/functional-regression.cjs', 'utf8');
  source = source.replace("const directory = 'docs/functional-regression';", `const directory = '${directory}';`);
  source = source.replace("save('integrity-summary', result);", "save('integrity-summary', result); if (result.differences.length || !result.schemasUnchanged || !result.catalogUnchanged || !result.migrationsUnchanged || !result.originalEnvUnchanged) throw Error('INTEGRITY_CHANGED');");
  fs.copyFileSync('docs/functional-regression/candidate-identity/integrity-after.json', `${directory}/integrity-before.json`);
  const filename = path.resolve('scripts/functional-regression.cjs'); const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; process.argv[2] = 'after'; mod._compile(source, filename);
} else if (mode === 'before' || mode === 'after') {
  // Reuse existing authenticated fixture setup in memory, without editing it
  // or enabling its candidate-migration testing mode.
  let source = fs.readFileSync('scripts/functional-rollback-browser.cjs', 'utf8');
  source = source.replace(/^const directory = .*;$/m, `const directory = '${directory}/${mode}';`);
  source = source.replace('    if (property === \'user\')', `    if (['job', 'employee'].includes(property)) return new Proxy(target[property], { get(model, method) {
      const value = Reflect.get(model, method);
      if (typeof value !== 'function') return value;
      return async (...args) => {
        if (globalThis.__uiDelay === property && ['findMany', 'count'].includes(method)) await new Promise(resolve => globalThis.__uiGateMode ? (globalThis.__uiReleases ||= []).push(resolve) : setTimeout(resolve, 1200));
        const start = performance.now(); const result = await value.apply(model, args);
        if (property === 'job' && method === 'findMany') (globalThis.__uiQueries ||= []).push({ durationMs: Math.round(performance.now()-start), take: args[0]?.take ?? null, skip: args[0]?.skip ?? null, selected: args[0]?.select ? Object.keys(args[0].select) : null, rows: result.length, returnedBytes: Buffer.byteLength(JSON.stringify(result)) });
        return result;
      };
    } });
    if (property === 'user')`);
  source = source.replace("      if (candidateOnly) {", `      await require('./test-ui-batch1-browser.cjs')({ tx, org, foreign, users, primary, job, session, port, tenantHost, save, ok, phase: '${mode}' });
      await session.close(); session = null;
      await new Promise(resolve => server.close(resolve)); server = null;
      await app.close(); app = null;
      throw rollback;
      if (candidateOnly) {`);
  source = source.replace("if (error !== rollback) { save('browser-failure'", "if (error !== rollback) { save('ui-failure-step', { step: globalThis.__uiStep, assertion: error.code === 'ERR_ASSERTION' ? error.message.split('\\n')[0].slice(0, 200) : undefined }); save('browser-failure'");
  delete process.env.FR_IDENTITY_REVIEW; delete process.env.FR_CANDIDATE_DOCUMENTS;
  const filename = path.resolve('scripts/functional-rollback-browser.cjs'); const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; mod._compile(source, filename);
} else {
  const env = { ...config.environment, DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), NODE_ENV: 'production' };
  const commands = {
    build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
    typescript: ['node_modules/typescript/bin/tsc', '--noEmit'],
    lint: ['node_modules/eslint/bin/eslint.js', 'src/components/ui/Skeleton.tsx', 'src/components/ui/PageSkeleton.tsx', 'src/components/ui/SkeletonCard.tsx', 'src/components/ui/TableSkeleton.tsx', 'src/components/employees/EmployeeDirectoryTable.tsx', 'src/features/hiring/job-list.ts', 'src/app/(dashboard)/loading.tsx', 'src/app/(dashboard)/dashboard/loading.tsx', 'src/app/(dashboard)/dashboard/hiring/jobs', 'src/app/(dashboard)/dashboard/hiring/pipeline/loading.tsx', 'src/app/(dashboard)/dashboard/hiring/interviews/loading.tsx', 'src/app/(dashboard)/dashboard/employees/loading.tsx', 'src/app/(dashboard)/dashboard/employees/[employeeId]/loading.tsx', 'src/app/(dashboard)/dashboard/attendance/loading.tsx', 'src/app/(dashboard)/dashboard/leave/loading.tsx', 'src/app/(dashboard)/dashboard/payroll/loading.tsx', 'src/app/(dashboard)/dashboard/analytics/loading.tsx', 'scripts/ui-batch1.cjs', 'scripts/test-ui-batch1-browser.cjs', 'scripts/test-ui-batch1-jobs.cjs'],
    unit: ['scripts/test-ui-batch1-jobs.cjs'],
  };
  if (!commands[mode]) throw Error('UNKNOWN_MODE');
  const start = performance.now(); const child = spawn(process.execPath, commands[mode], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', part => output += part);
  child.on('exit', code => { save(mode, { exitCode: code, elapsedMs: Math.round(performance.now() - start), output: output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]').split(/\r?\n/).filter(Boolean).slice(-90) }); helper.assertOriginalUnchanged(config); console.log(JSON.stringify({ mode, exitCode: code })); process.exitCode = code || 0; });
}

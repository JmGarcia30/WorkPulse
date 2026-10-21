/* eslint-disable @typescript-eslint/no-require-imports -- Isolated production UI verification. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const directory = 'docs/loading-consistency';
fs.mkdirSync(directory, { recursive: true });
const mode = process.argv[2];
const changes = execFileSync('git', ['ls-files', '--modified', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(f => f && !f.startsWith('.impeccable/') && fs.existsSync(f));
const lintFiles = changes.filter(f => /\.(?:tsx?|cjs)$/.test(f));
if (mode === 'browser') {
  let source = fs.readFileSync('scripts/functional-rollback-browser.cjs', 'utf8');
  source = source.replace(/^const directory = .*;$/m, `const directory = '${directory}/browser';`);
  source = source.replace("    if (property === 'user')", `    if (globalThis.__loadingModel === property || globalThis.__loadingFailure === property) return new Proxy(target[property], { get(model, method) {
      const value = Reflect.get(model, method);
      if (typeof value !== 'function') return value;
      return async (...args) => {
        if (globalThis.__loadingFailure === property && String(method).startsWith('find')) throw Error('TEST_LOADING_READ_FAILURE');
        if (globalThis.__loadingModel === property && (String(method).startsWith('find') || method === 'count')) await new Promise(resolve => (globalThis.__loadingReleases ||= []).push(resolve));
        return value.apply(model, args);
      };
    } });
    if (property === 'user')`);
  source = source.replace('      if (candidateOnly) {', `      await require('./test-loading-consistency-browser.cjs')({ tx, org, users, primary, job, candidate, session, port, tenantHost, save, ok });
      await session.close(); session = null;
      await new Promise(resolve => server.close(resolve)); server = null;
      await app.close(); app = null;
      throw rollback;
      if (candidateOnly) {`);
  // Never enable candidate schema setup or another suite's mutation paths.
  for (const name of ['FR_IDENTITY_REVIEW', 'FR_CANDIDATE_DOCUMENTS', 'FR_PROFILE_SECURITY', 'FR_SECURITY_BASELINE', 'FR_ROLE_ONLY']) delete process.env[name];
  const filename = path.resolve('scripts/functional-rollback-browser.cjs');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = module.paths; mod._compile(source, filename);
} else {
  const commands = {
    build: ['node_modules/next/dist/bin/next', 'build', '--webpack'],
    typescript: ['node_modules/typescript/bin/tsc', '--noEmit'],
    lint: ['node_modules/eslint/bin/eslint.js', ...lintFiles],
    unit: ['scripts/test-loading-consistency.cjs'],
  };
  if (!commands[mode]) throw Error('UNKNOWN_MODE');
  const env = { ...config.environment, NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct) };
  const start = performance.now(), child = spawn(process.execPath, commands[mode], { env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  let output = ''; for (const stream of [child.stdout, child.stderr]) stream.on('data', part => output += part);
  child.on('error', () => { console.error('CHECK_PROCESS_FAILED'); process.exitCode = 1; });
  child.on('exit', code => {
    fs.writeFileSync(`${directory}/${mode}.json`, JSON.stringify({ exitCode: code, elapsedMs: Math.round(performance.now() - start), output: output.replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g, '[EMAIL]').split(/\r?\n/).filter(Boolean).slice(-100) }, null, 2));
    helper.assertOriginalUnchanged(config); console.log(JSON.stringify({ mode, exitCode: code })); process.exitCode = code || 0;
  });
}

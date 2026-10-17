/* eslint-disable @typescript-eslint/no-require-imports -- Local read-only runtime diagnosis. */
const fs = require('node:fs');
const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/runtime-recovery';
fs.mkdirSync(directory, { recursive: true });
const save = (name, data) => fs.writeFileSync(directory + '/' + name + '.json', JSON.stringify(data, null, 2));
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!verified.h10Applied || verified.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_RECOVERY');
const endpoint = url => helper.digest(new URL(url).hostname.replace('-pooler.', '.'));

async function inspect() {
  const inheritedDatabase = Boolean(process.env.DATABASE_URL);
  const loaded = loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const selected = new URL(process.env.DATABASE_URL);
  const original = new URL(require('node:util').parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  const selectedEndpoint = endpoint(selected);
  if (![endpoint(original), config.identity.endpointSha256].includes(selectedEndpoint)) helper.fail('UNRECOGNIZED_LOCAL_DATABASE');
  const databases = [];
  for (const [label, url] of [['original', original], ['recovery', config.pooled]]) {
    const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(url) } }, log: [] });
    try {
      const migrations = await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      const state = await db.$queryRaw`SELECT current_schema() AS schema, current_setting('default_transaction_read_only') AS read_only`;
      const result = { label, selectedByNextDev: endpoint(url) === selectedEndpoint, state: state[0], appliedMigrations: migrations.length,
        h10Applied: ['20261017090000_h10_1_exit_clearance', '20261017120000_h10_2_final_separation'].every(name => migrations.some(m => m.migration_name === name)) };
      for (const [name, query] of [['probationColumn', () => db.probationRecord.findMany({ take: 1, select: { closedBySeparationCaseId: true } })], ['separationTable', () => db.employeeSeparationCase.count()]]) {
        try { await query(); result[name] = { success: true }; }
        catch (e) { result[name] = { success: false, code: e.code || e.name }; }
      }
      databases.push(result);
    } finally { await db.$disconnect(); }
  }
  const result = { capturedAt: new Date().toISOString(), inheritedDatabase, loadedFiles: loaded.loadedEnvFiles.map(f => f.path), selectedEnvironment: selectedEndpoint === config.identity.endpointSha256 ? 'approved recovery child' : 'original production/pending H10', databases, originalEnvUnchanged: helper.digest(fs.readFileSync('.env')) === config.identity.originalEnvSha256 };
  save(process.argv[3] || 'database-selection-before', result); console.log(JSON.stringify(result));
}
async function issues() {
  const response = await fetch('http://127.0.0.1:3000/_next/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_errors', arguments: {} } }) });
  const body = await response.text();
  const frame = body.split('\n').find(l => l.startsWith('data: '));
  if (!frame) helper.fail('NO_DEVTOOLS_RESPONSE');
  const payload = JSON.parse(frame.slice(6));
  const result = JSON.parse(payload.result.content[0].text);
  save(process.argv[3] || 'live-issues-before', result);
  console.log(JSON.stringify(result));
}
async function main() {
  if (process.argv[2] === 'inspect') return inspect();
  if (process.argv[2] === 'issues') return issues();
  helper.fail('UNKNOWN_MODE');
}
main().catch(e => { console.error(JSON.stringify({ code: e.code || e.name })); process.exitCode = 1; });

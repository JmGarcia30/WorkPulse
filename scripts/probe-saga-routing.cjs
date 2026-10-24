/* eslint-disable @typescript-eslint/no-require-imports -- Read-only local production-server SAGA routing smoke test. */
const fs = require('node:fs'), { createServer, request } = require('node:http');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const port = 3134;
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
async function main() {
  const app = require('next')({ dev: false, hostname: 'localhost', port }); await app.prepare();
  const server = createServer(app.getRequestHandler()); await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  try {
    for (const path of ['/saga', '/saga/login', '/tenant-entry']) await new Promise((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, path, headers: { host: 'localhost:' + port } }, res => { res.resume(); res.on('end', () => { console.log(JSON.stringify({ path, status: res.statusCode, location: res.headers.location, routingResponseHeaders: Object.keys(res.headers).filter(key => key.includes('workpulse')) })); resolve(); }); }); req.on('error', reject); req.end();
    });
  } finally { await new Promise(resolve => server.close(resolve)); await app.close(); helper.assertOriginalUnchanged(config); }
}
main().catch(error => { console.error(error.code || error.name); process.exitCode = 1; });

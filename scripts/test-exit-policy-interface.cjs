/* eslint-disable @typescript-eslint/no-require-imports -- Production HTTP forms over recovery-only rollback fixtures. */
const assert = require('node:assert/strict'), fs = require('node:fs'), { createServer, request: rawRequest } = require('node:http');
const { PrismaClient, Prisma } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs'), config = helper.configuration();
const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
const rollback = Symbol('interface-rollback'), scenarios = [];
const ok = (value, scenario) => { assert(value, scenario); scenarios.push(scenario); console.log('PASS ' + scenario); };
const port = 3127;
Object.assign(process.env, config.environment, { NODE_ENV: 'production', DATABASE_URL: helper.readOnly(config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(config.direct), PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port });
function client(tx) {
  let queue = Promise.resolve(), sequence = 0;
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return operation => {
      const work = async () => {
        const name = 'exit_ui_' + (++sequence);
        await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work, work); queue = result.catch(() => {}); return result;
    };
    return Reflect.get(target, key);
  } });
}
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
function formFor(html) {
  const body = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(match => match[1]).find(body => body.includes('name="noticePeriod"'));
  assert(body, 'Rendered policy form missing');
  const fields = new FormData();
  for (const input of body.matchAll(/<input\b[^>]*>/g)) {
    const name = input[0].match(/\bname="([^"]*)"/)?.[1], value = input[0].match(/\bvalue="([^"]*)"/)?.[1];
    if (name?.startsWith('$ACTION_')) fields.set(decode(name), decode(value ?? ''));
  }
  assert([...fields.keys()].length > 0);
  fields.set('noticePeriod', '45'); fields.set('noticeUnit', 'CALENDAR_DAYS'); fields.set('allowExceptions', 'on');
  return fields;
}
async function main() {
  let app, server;
  const before = await helper.fingerprints(db);
  try {
    await db.$transaction(async tx => {
      globalThis.prisma = client(tx);
      // Proxy runs in a separate runtime and must see persisted tenant identities.
      // Reuse identities only; policy/user changes remain uncommitted and roll back.
      const organization = await tx.organization.findFirstOrThrow({ where: { slug: { not: 'st-aloysius' } } });
      const slug = organization.slug, marker = 'exitui' + Date.now();
      const saga = await tx.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
      const foreign = saga;
      await tx.organization.update({ where: { id: organization.id }, data: { resignationPolicy: Prisma.DbNull } });
      const user = (org, role, suffix) => tx.user.create({ data: { organizationId: org.id, role, name: role, email: `${marker}-${suffix}@fixture.invalid` } });
      const hr = await user(organization, 'HR_ADMIN', 'hr'), admin = await user(organization, 'ORGANIZATION_ADMIN', 'admin'), foreignHr = await user(foreign, 'HR_ADMIN', 'foreign'), sagaHr = await user(saga, 'HR_ADMIN', 'saga');
      const { SignJWT } = await import('jose');
      async function cookie(actor) {
        const token = await new SignJWT({ userId: actor.id, organizationId: actor.organizationId, role: actor.role, name: actor.name, email: actor.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(config.environment.SESSION_SECRET));
        return '__Host-workpulse_session=' + token;
      }
      app = require('next')({ dev: false, hostname: 'localhost', port });
      await app.prepare();
      const handle = app.getRequestHandler();
      server = createServer((req, res) => handle(req, res));
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      const hrCookie = await cookie(hr), settings = '/dashboard/settings/exit';
      function request(path, method, headers, body) {
        return new Promise((resolve, reject) => {
          const req = rawRequest({ hostname: '127.0.0.1', port, path, method, headers }, response => {
            let html = ''; response.setEncoding('utf8'); response.on('data', chunk => html += chunk);
            response.on('end', () => resolve({ status: response.statusCode, location: response.headers.location, html }));
          });
          req.on('error', reject); req.end(body);
        });
      }
      async function get(path, session = hrCookie, host = slug + '.localhost') {
        return request(path, 'GET', { host: `${host}:${port}`, 'x-forwarded-host': `${host}:${port}`, cookie: session });
      }
      async function post(fields, session = hrCookie) {
        const encoded = new Request('http://localhost', { method: 'POST', body: fields });
        const body = Buffer.from(await encoded.arrayBuffer());
        const response = await request(settings, 'POST', { host: `${slug}.localhost:${port}`, 'x-forwarded-host': `${slug}.localhost:${port}`, origin: `http://${slug}.localhost:${port}`, cookie: session, 'content-type': encoded.headers.get('content-type'), 'content-length': String(body.length) }, body);
        assert(response.status < 500); return response.html;
      }
      const initial = await get(settings);
      if (initial.status !== 200 || !initial.html.includes('name="noticePeriod"')) console.log(JSON.stringify({ initialStatus: initial.status, location: initial.location, title: initial.html.match(/<title>(.*?)<\/title>/)?.[1] }));
      ok(initial.status === 200 && initial.html.includes('No resignation policy is configured') && initial.html.includes('name="noticePeriod"'), 'HR settings render missing-policy guidance and editable notice form');
      const missing = await get('/dashboard/employees/exit/new');
      ok(missing.status === 200 && missing.html.includes('Resignation notice requirements have not been configured') && missing.html.includes('/dashboard/settings/exit'), 'Exit creation renders missing-policy guidance with organization settings link');
      const forged = formFor(initial.html); forged.set('organizationId', foreign.id);
      await post(forged);
      assert.equal((await tx.organization.findUniqueOrThrow({ where: { id: organization.id } })).resignationPolicy, null);
      await post(formFor(initial.html));
      const stored = (await tx.organization.findUniqueOrThrow({ where: { id: organization.id } })).resignationPolicy;
      ok(stored.policy.noticePeriod === 45 && stored.configuredById === hr.id, 'Rendered Server Action saves authenticated organization policy and recorder');
      const saved = await get(settings);
      ok(saved.html.includes('value="45"') && !saved.html.includes('No resignation policy is configured'), 'Reloaded settings show saved notice requirements');
      const configuredExit = await get('/dashboard/employees/exit/new');
      ok(!configuredExit.html.includes('Resignation notice requirements have not been configured'), 'Exit guidance clears after configuration');
      const adminPage = await get(settings, await cookie(admin));
      ok(!adminPage.html.includes('name="noticePeriod"') && adminPage.html.includes('Only your organization'), 'Organization Admin sees read-only policy guidance');
      await post(formFor(saved.html), await cookie(admin));
      const foreignPage = await get(settings, await cookie(foreignHr));
      ok(foreignPage.status !== 200 || !foreignPage.html.includes('name="noticePeriod"'), 'Foreign tenant HR cannot view organization policy form');
      await post(formFor(saved.html), await cookie(foreignHr));
      assert.equal((await tx.organization.findUniqueOrThrow({ where: { id: foreign.id } })).resignationPolicy, null);
      const sagaPage = await get(settings, await cookie(sagaHr), 'saga.localhost');
      ok(sagaPage.status === 200 && sagaPage.html.includes('one-calendar-month') && !sagaPage.html.includes('name="noticePeriod"'), 'SAGA settings display fixed institutional policy');
      await tx.user.update({ where: { id: hr.id }, data: { role: 'HIRING_MANAGER' } });
      await post(formFor(saved.html));
      assert.deepEqual((await tx.organization.findUniqueOrThrow({ where: { id: organization.id } })).resignationPolicy, stored);
      ok(true, 'Forged tenant fields, foreign sessions, Organization Admin and stale HR sessions cannot change policy through HTTP actions');
      await new Promise(resolve => server.close(resolve)); server = null;
      await app.close(); app = null;
      throw rollback;
    }, { timeout: 600000, maxWait: 10000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close(); delete globalThis.prisma;
  }
  assert.deepEqual((await helper.fingerprints(db, before.columns)).tables, before.tables);
  helper.assertOriginalUnchanged(config);
  fs.writeFileSync('docs/exit-policy/interface.json', JSON.stringify({ passed: true, scenarios, existingTablesPreserved: before.tables.length, fixtureRollback: true, coverage: 'Rendered HTML and real HTTP Server Actions; no visual browser claim.' }, null, 2));
}
main().catch(error => { console.error(error.name, String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[CONNECTION]')); process.exitCode = 1; }).finally(() => db.$disconnect());

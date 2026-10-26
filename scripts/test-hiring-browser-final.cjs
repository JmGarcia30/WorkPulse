/* eslint-disable @typescript-eslint/no-require-imports -- Real local browser/actions; synthetic fixtures in an always-rolled-back PostgreSQL transaction. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
const { context, rollbackClient, save, helper, directory } = require('./hiring-postgres-fixtures.cjs');
const browser = require('./batch0-recovery-browser.cjs');
const localFetch = require('./candidate-test-http.cjs');
require('tsx/cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
function ok(condition, label) { assert(condition, label); checks.push({ label, status: 'PASS' }); save('browser-progress', { checks }); console.log('PASS ' + label); }
async function main() {
  const ctx = await context();
  const before = await helper.fingerprints(ctx.db);
  let app, server, session, failure;
  const port = 3127;
  Object.assign(process.env, ctx.config.environment, {
    NODE_ENV: 'production', DATABASE_URL: helper.readOnly(ctx.config.pooled), H10_TEST_DATABASE_URL: helper.readOnly(ctx.config.direct),
    PLATFORM_ROOT_DOMAIN: 'localhost:' + port, PLATFORM_PUBLIC_ORIGIN: 'http://localhost:' + port,
  });
  const rollback = Symbol('browser fixtures always rollback');
  try {
    await ctx.db.$transaction(async tx => {
      try {
      globalThis.prisma = rollbackClient(tx);
      const password = randomBytes(24).toString('hex');
      const owner = await ctx.tenant(tx, false, await hash(password, 10));
      const foreign = await ctx.tenant(tx);
      const blocked = await ctx.candidate(tx, owner, { incomplete: true });
      const legacy = await ctx.candidate(tx, owner, { status: 'HIRED', incomplete: true });
      const screening = await ctx.candidate(tx, owner, { status: 'INTERVIEW' });
      const progress = await ctx.candidate(tx, owner, { status: 'INTERVIEW' });
      const ready = await ctx.candidate(tx, owner);
      const hidden = await ctx.candidate(tx, foreign);
      const reviewTask = blocked.process.tasks[0];
      await tx.onboardingTask.update({ where: { id: reviewTask.id }, data: { status: 'SUBMITTED' } });
      await tx.interview.updateMany({ where: { applicationId: screening.application.id, type: 'INITIAL_SCREENING' }, data: { status: 'SCHEDULED' } });
      const tenantHost = owner.org.slug + '.localhost';
      const origin = `http://${tenantHost}:${port}`;
      app = require('next')({ dev: false, hostname: '127.0.0.1', port });
      await app.prepare();
      const handler = app.getRequestHandler();
      server = createServer((request, response) => handler(request, response));
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
      session = await browser({ port, production: true, email: owner.actors.HR_ADMIN.email, password, tenantHost });
      ok(true, 'Normal password login reaches synthetic tenant dashboard through real auth/session storage');
      async function until(expression, label) {
        for (let attempt = 0; attempt < 300; attempt++) {
          if (await session.evaluate(expression)) return;
          await pause(100);
        }
        const state = await session.evaluate(`({path:location.pathname,ready:document.readyState,title:document.title,headings:[...document.querySelectorAll('h1,h2,h3')].map(element=>element.textContent),mainText:(document.querySelector('main')?.innerText||document.body.innerText).slice(0,1200)})`);
        save('browser-timeout', { label, state });
        await screenshot('browser-timeout');
        throw Error('BROWSER_' + label);
      }
      async function navigate(route, expected) {
        await session.send('Page.navigate', { url: origin + route });
        await until(`document.readyState==='complete' && (document.querySelector('main')?.innerText||'').toLowerCase().includes(${JSON.stringify(expected.toLowerCase())})`, 'PAGE_READY');
        await pause(500);
      }
      const button = label => `[...document.querySelectorAll('main button,dialog button')].find(button=>button.textContent.trim()===${JSON.stringify(label)})`;
      async function click(label) {
        assert(await session.evaluate(`(()=>{const button=${button(label)};if(!button||button.disabled)return false;button.click();return true})()`), 'Clickable browser button: ' + label);
      }
      async function screenshot(name) {
        const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(`${directory}/${name}.png`, Buffer.from(result.data, 'base64'));
      }
      await navigate('/dashboard/hiring/applicants/' + blocked.application.id, 'Hiring Readiness Gate');
      await until(`${button('Hire Candidate')}?.disabled===true`, 'BLOCKED_HIRE');
      ok(await session.evaluate(`document.querySelector('main').innerText.includes('NOT READY TO HIRE')`), 'Profile shows NOT READY and disabled hiring for incomplete COMPLETED checklist');
      const stageNumbers = await session.evaluate(`[...document.querySelector('main').textContent.matchAll(/Stage ([0-9]+) of ([0-9]+)/g)].map(match=>match[1]+'/'+match[2])`);
      save('browser-stage-numbers', { stageNumbers });
      ok(stageNumbers.length >= 2 && stageNumbers[0] === stageNumbers[1] && stageNumbers[0].endsWith('/7') && stageNumbers[0] !== '2/7', 'Progress tracker and stage controller display the same derived generic lifecycle number');
      await screenshot('blocked-profile');

      // Attempt direct Server Actions to prove disabled buttons are not the gate.
      const manifest = JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json'));
      const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.edge');
      async function action(name, args, route) {
        const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
        assert(entry, 'Built server action exists: ' + name);
        const body = await encodeReply(args);
        const response = await localFetch(`http://127.0.0.1:${port}${route}`, { method: 'POST', redirect: 'manual', headers: {
          host: `${tenantHost}:${port}`, 'x-forwarded-host': `${tenantHost}:${port}`, origin,
          cookie: session.cookie, 'next-action': entry[0], accept: 'text/x-component',
          ...(typeof body === 'string' ? { 'content-type': 'text/plain;charset=UTF-8' } : {}),
        }, body });
        return { status: response.status, text: await response.text() };
      }
      const premature = await action('convertApplicationToEmployeeAction', [blocked.application.id, { probationStandardsConfirmed: true }], '/dashboard/hiring/applicants/' + blocked.application.id);
      ok(premature.status === 200 && premature.text.includes('NOT_READY') && await tx.employee.count({ where: { sourceApplicationId: blocked.application.id } }) === 0, 'Direct authenticated HTTP conversion cannot bypass missing onboarding requirements');

      await navigate('/dashboard/hiring/applicants/' + legacy.application.id, 'Complete Employee Record');
      await until(`${button('Complete Employee Record')}?.disabled===true`, 'BLOCKED_LEGACY_RECOVERY');
      ok(await session.evaluate(`document.querySelector('main').innerText.includes('blocked until current requirements are satisfied')`), 'Legacy HIRED recovery is disabled and explains current unmet prerequisites');
      await screenshot('legacy-recovery-blocked');

      await navigate('/dashboard/hiring/applicants/' + blocked.application.id + '?tab=onboarding', 'Pre-Employment & Onboarding Checklist');
      await click('Review / Verify');
      await until(`!!document.querySelector('dialog[aria-label="Review onboarding task"]')?.open`, 'REVIEW_MODAL');
      await click('Verify & Approve');
      await until(`!document.querySelector('dialog[aria-label="Review onboarding task"]')`, 'VERIFY_RESPONSE');
      let process = await tx.onboardingProcess.findUniqueOrThrow({ where: { id: blocked.process.id } });
      ok(process.status === 'COMPLETED' && process.completedAt.getTime() === blocked.process.completedAt.getTime() && process.notes === blocked.process.notes, 'Browser task verification preserves legacy completion status, timestamp and notes');
      await until(`document.querySelector('main').innerText.includes('1 Verified')`, 'VERIFIED_TASK_REFRESH');
      await click('Review / Verify');
      await until(`!!document.querySelector('textarea[aria-label="Reason for Reopening (Required)"]')`, 'REOPEN_REASON');
      ok(await session.evaluate(`${button('Reopen Item')}?.disabled===true`), 'Explicit Reopen Item starts blocked until a fresh reason is entered');
      await session.evaluate(`(()=>{const area=document.querySelector('textarea[aria-label="Reason for Reopening (Required)"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'Synthetic browser reopening for verification');area.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
      await until(`${button('Reopen Item')}?.disabled===false`, 'REOPEN_ENABLED');
      await click('Reopen Item');
      await until(`!document.querySelector('dialog[aria-label="Review onboarding task"]')`, 'REOPEN_RESPONSE');
      process = await tx.onboardingProcess.findUniqueOrThrow({ where: { id: process.id } });
      const audit = JSON.parse(process.notes.split('[onboarding-audit] ').at(-1));
      ok(process.status === 'IN_PROGRESS' && process.completedAt.getTime() === blocked.process.completedAt.getTime() && audit.action === 'TASK_REOPENED' && audit.actorUserId === owner.actors.HR_ADMIN.id, 'Browser explicit reopening persists authorized audit and preserves the historical completion timestamp');

      await navigate('/dashboard/hiring/pipeline', 'Hiring Pipeline');
      await session.evaluate(`(()=>{const card=document.querySelector('a[href="/dashboard/hiring/applicants/${screening.application.id}"]').closest('div.group');[...card.querySelectorAll('button')].find(button=>button.textContent.trim()==='Move').click();return true})()`);
      await until(`!!document.querySelector('dialog[aria-label="Move candidate stage"]')?.open && document.querySelector('dialog').innerText.includes('INITIAL_SCREENING')`, 'BOARD_RESTRICTIONS');
      ok(await session.evaluate(`${button('Move Candidate to Assessment')}?.disabled===true`), 'Kanban Move dialog blocks progression while initial screening is scheduled');
      const bypass = await action('updateApplicationStatusAction', [screening.application.id, 'ASSESSMENT'], '/dashboard/hiring/pipeline');
      ok(bypass.status === 200 && bypass.text.includes('INITIAL_SCREENING') && (await tx.application.findUniqueOrThrow({ where: { id: screening.application.id } })).status === 'INTERVIEW', 'Direct HTTP stage action repeats scheduled-interview enforcement');
      await click('Rejected');
      await until(`${button('Move Candidate to Rejected')}?.disabled===false`, 'REJECTION_AVAILABLE');
      await click('Move Candidate to Rejected');
      await until(`!document.querySelector('dialog[aria-label="Move candidate stage"]')`, 'REJECTION_RESPONSE');
      ok((await tx.application.findUniqueOrThrow({ where: { id: screening.application.id } })).status === 'REJECTED' && await tx.applicationStatusHistory.count({ where: { applicationId: screening.application.id } }) === 1, 'Authorized rejection remains available despite incomplete interviews and records one status event');

      await navigate('/dashboard/hiring/applicants/' + progress.application.id, 'Stage Controller');
      await until(`${button('Move Candidate to Assessment')}?.disabled===false`, 'VALID_PROGRESSION');
      await click('Move Candidate to Assessment');
      await until(`document.querySelector('main').innerText.includes('Current: Assessment')`, 'PROGRESSION_RESPONSE');
      ok((await tx.application.findUniqueOrThrow({ where: { id: progress.application.id } })).status === 'ASSESSMENT' && await tx.applicationStatusHistory.count({ where: { applicationId: progress.application.id } }) === 1, 'Profile progression commits prerequisites-approved status and renders the updated stage');

      const foreignAttempt = await action('convertApplicationToEmployeeAction', [hidden.application.id, { probationStandardsConfirmed: true }], '/dashboard/hiring/applicants/' + ready.application.id);
      ok(foreignAttempt.text.includes('APPLICATION_NOT_FOUND') && await tx.employee.count({ where: { sourceApplicationId: hidden.application.id } }) === 0, 'Authenticated HTTP conversion rejects foreign-tenant application IDs');
      await navigate('/dashboard/hiring/applicants/' + ready.application.id, 'READY TO HIRE');
      await until(`${button('Hire Candidate')}?.disabled===false`, 'READY_HIRE');
      await click('Hire Candidate');
      await until(`!!document.querySelector('dialog[aria-label="Confirm candidate hire"]')?.open`, 'HIRE_MODAL');
      await session.evaluate(`document.querySelector('dialog input[type=checkbox]').click();true`);
      await until(`${button('Confirm Hire')}?.disabled===false`, 'CONFIRM_ENABLED');
      await click('Confirm Hire');
      await until(`location.pathname.startsWith('/dashboard/employees/')`, 'EMPLOYEE_REDIRECT');
      const hired = await tx.application.findUniqueOrThrow({ where: { id: ready.application.id }, include: { employee: { include: { employmentRecords: { include: { probation: true } } } }, history: true } });
      ok(hired.status === 'HIRED' && hired.history.length === 1 && hired.employee.employmentRecords[0].probation, 'Browser hiring performs atomic conversion and opens the linked employee record');
      await until(`(document.querySelector('main')?.innerText||'').includes(${JSON.stringify(hired.employee.employeeNumber)})`, 'EMPLOYEE_PROFILE_RENDER');
      await screenshot('successful-employee-conversion');
      save('browser-results', { status: 'PASS', checks, normalPasswordLogin: true, realBrowserServerActions: true, databaseMode: 'One outer PostgreSQL rollback transaction; nested HTTP actions use savepoints. Real concurrent commits are tested separately.', externalEmailOrStorage: false });
      await session.close(); session = null;
      await new Promise(resolve => server.close(resolve)); server = null;
      await app.close(); app = null;
      throw rollback;
      } finally {
        await session?.close(); session = null;
        if (server) { await new Promise(resolve => server.close(resolve)); server = null; }
        await app?.close(); app = null;
      }
    }, { isolationLevel: ctx.Prisma.TransactionIsolationLevel.Serializable, timeout: 600000, maxWait: 15000 });
  } catch (error) {
    if (error !== rollback) { failure = error; save('browser-results', { status: 'FAIL', checks, errorCode: error.code || error.name, message: /^BROWSER_/.test(error.message) || error.code === 'ERR_ASSERTION' ? error.message : undefined }); }
  } finally {
    await session?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await app?.close(); delete globalThis.prisma;
    try {
      const cleanup = await ctx.cleanup();
      const after = await helper.fingerprints(ctx.db, before.columns);
      const changedTables = before.tables.filter((table, index) => JSON.stringify(table) !== JSON.stringify(after.tables[index])).map(table => table.table);
      save('browser-cleanup', { ...cleanup, status: changedTables.length ? 'FAIL' : 'PASS', changedTables, comparedTables: before.tables.length, outerTransactionRolledBack: true });
      assert.equal(changedTables.length, 0, 'Existing rows changed after rollback-only browser tests');
    } finally { await ctx.db.$disconnect(); helper.assertOriginalUnchanged(ctx.config); }
  }
  if (failure) throw failure;
  console.log(JSON.stringify({ status: 'PASS', browserChecks: checks.length, rollbackConfirmed: true, existingDataPreserved: true }));
}
main().catch(error => { console.error(JSON.stringify({ status: 'FAIL', code: error.code || error.name, locations: error.stack?.split('\n').filter(line => line.trim().startsWith('at ')).slice(0, 4) })); process.exitCode = 1; });

/* eslint-disable @typescript-eslint/no-require-imports -- Browser layout and warmed production navigation checks. */
const assert = require('node:assert/strict'), fs = require('node:fs');
module.exports = async function ({ tx, org, foreign, users, primary, job, session, port, tenantHost, save, ok, phase }) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  await session.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__uiErrors=[];const report=console.error;console.error=(...args)=>{window.__uiErrors.push('console');report.apply(console,args)};window.addEventListener('error',()=>window.__uiErrors.push('runtime'));window.addEventListener('unhandledrejection',()=>window.__uiErrors.push('promise'));` });
  await tx.job.createMany({ data: Array.from({ length: 61 }, (_, i) => ({ organizationId: org.id, id: `ui-job-${String(i).padStart(3, '0')}-${org.id}`, title: `UI Position ${String(i).padStart(3, '0')}${i === 60 ? ' ' + 'LongTitle'.repeat(18) : ''}`, slug: 'ui-job-' + i, department: 'UI Department', location: i === 60 ? 'LongLocation'.repeat(12) : 'Campus', employmentType: 'Full-time', description: 'Description '.repeat(1500), responsibilities: 'Responsibilities', qualifications: 'Qualifications', requirements: 'Requirements', status: ['PUBLISHED', 'DRAFT', 'CLOSED', 'ARCHIVED'][i % 4], category: 'NON_TEACHING', closingDate: new Date('2026-12-01'), createdAt: new Date(Date.UTC(2026, 10, 1) + Math.floor(i / 3) * 1000) })) });
  async function goto(route, title) {
    globalThis.__uiStep = route;
    await session.send('Page.navigate', { url: `http://${tenantHost}:${port}${route}` });
    for (let i = 0; i < 250; i++) { if (await session.evaluate(`document.readyState==='complete' && document.querySelector('main')?.innerText.includes(${JSON.stringify(title)}) && !document.querySelector('main [data-wp-loading]')`)) { await pause(200); return; } await pause(60); }
    throw Error('PAGE_NOT_READY');
  }
  await session.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const measurements = []; globalThis.__uiQueries = [];
  for (let i = 0; i < 6; i++) {
    await goto('/dashboard/employees', 'Employee Records');
    const row = await session.navigate({ name: 'Job Openings', route: '/dashboard/hiring/jobs', expected: ['Job Postings', 'UI Position'], sidebar: true });
    assert(row.completed && row.failedHttpResponses.length === 0 && row.runtimeExceptions === 0); if (i) measurements.push(row);
  }
  save('navigation', { phase, mode: 'production; same 62-job fixture; 1280px; one warm-up plus five samples; warm assets/server with a fresh employee-page document/router per sample; no injected latency', measurements, queries: globalThis.__uiQueries });
  ok(true, 'Five comparable warmed production Job Openings navigations completed');
  await pause(1000);
  const layouts = [];
  for (const width of [320, 375, 390, 768, 1280]) {
    await session.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    for (const [route, title] of [['/dashboard/hiring/jobs', 'Job Postings'], ['/dashboard/employees', 'Employee Records']]) {
      await goto(route, title);
      // Let unrelated Link prefetch streams settle before the next full-document
      // viewport probe. This wait is outside the navigation timing samples.
      await pause(800);
      const layout = await session.evaluate(`(()=>{const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,visibleActions:[...document.querySelectorAll('main a')].filter(visible).map(e=>({label:e.getAttribute('aria-label')||e.title||e.innerText,href:e.getAttribute('href')})),overflowing:[...document.querySelectorAll('main input,main button,main article,main nav')].filter(visible).filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left<0).map(e=>e.tagName)}})()`);
      layouts.push({ route, viewport: width, ...layout }); save('layouts', layouts);
      if (phase === 'after') {
        const image = await session.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`docs/ui-batch1/after/${route.endsWith('jobs') ? 'jobs' : 'employees'}-${width}.png`, Buffer.from(image.data, 'base64'));
        if (layout.overflow) save('overflow-detail', await session.evaluate(`([...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length && e.getBoundingClientRect().right>innerWidth+1).slice(0,40).map(e=>({tag:e.tagName,cls:e.className,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width,overflow:getComputedStyle(e).overflowX,position:getComputedStyle(e).position})))`));
        assert(!layout.overflow, `${route} overflows at ${width}`); assert.equal(layout.overflowing.length, 0);
        const overlaps = await session.evaluate(`(()=>{const controls=[...document.querySelectorAll('main input,main select,main button,main a')].filter(e=>e.getClientRects().length&&!e.closest('table'));let n=0;for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)n++}return n})()`);
        assert.equal(overlaps, 0, `Overlapping controls at ${width}`);
        assert.equal(await session.evaluate('window.__uiErrors?.length || 0'), 0);
      }
    }
  }
  if (phase === 'after') await require('./test-ui-batch1-browser.cjs').after({ tx, org, foreign, users, primary, job, session, port, tenantHost, save, ok, goto, pause });
  ok(true, 'Job Openings and Employee Records checked at all five viewport widths');
};

module.exports.after = async function ({ tx, org, foreign, users, job, session, port, tenantHost, save, ok, goto, pause }) {
  await session.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const observed = [];
  const cases = [
    ['', {}, 1], ['?page=2', {}, 2], ['?page=4', {}, 4], ['?page=99999999', {}, 4], ['?page=-4&status=invalid', {}, 1],
    ['?search=UI&status=PUBLISHED', { status: 'PUBLISHED', OR: [{ title: { contains: 'UI', mode: 'insensitive' } }, { department: { contains: 'UI', mode: 'insensitive' } }] }, 1],
    ['?search=UI%20Department&status=DRAFT', { status: 'DRAFT', OR: [{ title: { contains: 'UI Department', mode: 'insensitive' } }, { department: { contains: 'UI Department', mode: 'insensitive' } }] }, 1],
  ];
  for (const [query, filter, page] of cases) {
    const expected = await tx.job.findMany({ where: { organizationId: org.id, ...filter }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    await goto('/dashboard/hiring/jobs' + query, 'Job Postings');
    const actual = await session.evaluate(`({ids:[...document.querySelectorAll('main table tbody tr')].map(r=>r.querySelector('a')?.getAttribute('href')?.split('/').pop()).filter(Boolean),text:document.querySelector('main').innerText,links:[...document.querySelectorAll('nav[aria-label="Job pagination"] a')].map(a=>a.getAttribute('href'))})`);
    assert.deepEqual(actual.ids, expected.slice((page - 1) * 20, page * 20).map(row => row.id)); assert(actual.text.includes(`${expected.length} Positions`)); assert(!actual.text.includes('Foreign Secret Position'));
    observed.push({ query, total: expected.length, page, idsMatch: true, rendered: actual.ids.length });
  }
  await goto('/dashboard/hiring/jobs?search=UI&status=ALL', 'Job Postings');
  const next = await session.evaluate(`document.querySelector('nav[aria-label="Job pagination"] a')?.getAttribute('href')`); assert(next.includes('search=UI') && next.includes('status=ALL') && next.includes('page=2'));
  await goto('/dashboard/hiring/jobs?search=NO_MATCH_UI_FIXTURE', 'No job postings found.'); assert.equal(await session.evaluate(`document.querySelectorAll('nav[aria-label="Job pagination"] a').length`), 0);
  await goto('/dashboard/hiring/jobs?page=4', 'Job Postings'); assert.equal(await session.evaluate(`(()=>{const row=[...document.querySelectorAll('main table tbody tr')].find(r=>r.querySelector('a')?.getAttribute('href')===${JSON.stringify('/dashboard/hiring/jobs/' + job.id)});return row?.children[4].textContent.trim()})()`), '3');
  save('pagination', observed); ok(true, 'Real database filtering, total counts, stable tied-date ordering, clamping, empty state, application counts and filter-preserving pagination');

  const { SignJWT } = await import('jose');
  const token = async user => '__Host-workpulse_session=' + await new SignJWT({ userId: user.id, organizationId: user.organizationId, role: user.role, name: user.name, email: user.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const headers = cookie => ({ host: `${tenantHost}:${port}`, 'x-forwarded-host': `${tenantHost}:${port}`, cookie });
  const manager = await fetch(`http://127.0.0.1:${port}/dashboard/hiring/jobs`, { headers: headers(await token(users.HIRING_MANAGER)), redirect: 'manual' }); const managerBody = await manager.text();
  assert(managerBody.includes('Job Postings')); assert(!managerBody.includes('Create Job Posting') && !managerBody.includes('title="Edit Job"')); ok(true, 'Hiring Manager retains listing/view access without create/edit actions');
  const outsider = await tx.user.create({ data: { organizationId: foreign.id, role: 'HR_ADMIN', name: 'Other HR', email: `other-ui-${org.id}@fixture.invalid` } });
  const wrongTenant = await fetch(`http://127.0.0.1:${port}/dashboard/hiring/jobs`, { headers: headers(await token(outsider)), redirect: 'manual' }); assert(!(await wrongTenant.text()).includes('UI Position')); ok(true, 'Wrong-tenant staff cannot receive job listing data');

  const skeletons = [];
  async function clickNav(route, width) {
    if (width < 768) { await session.evaluate(`document.querySelector('button[aria-label="Open navigation"]').click();true`); await pause(100); }
    await session.evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(width < 768 ? 'dialog' : 'aside')});root.querySelectorAll('button[aria-expanded=false]').forEach(b=>b.click());return true})()`); await pause(100);
    assert(await session.evaluate(`(()=>{const root=document.querySelector(${JSON.stringify(width < 768 ? 'dialog' : 'aside')});const a=root.querySelector('a[href="${route}"]');if(!a)return false;a.click();return true})()`));
  }
  for (const width of [320, 375, 390, 768, 1280]) {
    await session.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: width === 375 ? 'reduce' : 'no-preference' }] });
    for (const [kind, model, source, title, route] of [['jobs', 'job', '/dashboard/employees', 'Employee Records', '/dashboard/hiring/jobs'], ['employees', 'employee', '/dashboard/hiring/jobs', 'Job Postings', '/dashboard/employees']]) {
      globalThis.__uiDelay = model; globalThis.__uiGateMode = true; globalThis.__uiReleases = [];
      try {
        await goto(source, title);
        await session.evaluate(`window.__uiAside=document.querySelector('aside');window.__uiHeader=document.querySelector('header');window.__uiShellBox=document.querySelector('header').getBoundingClientRect().toJSON();true`);
        await clickNav(route, width);
        let shown = false; for (let i = 0; i < 120; i++) { if (await session.evaluate(`!!document.querySelector('[data-wp-loading="${kind}"]')?.getClientRects().length`)) { shown = true; break; } await pause(30); }
        assert(shown, `Missing ${kind} transition skeleton at ${width}`);
        const result = await session.evaluate(`(()=>{const root=document.querySelector('[data-wp-loading="${kind}"]');return {pageOverflow:document.documentElement.scrollWidth>innerWidth,headerRetained:window.__uiHeader===document.querySelector('header'),sidebarRetained:window.__uiAside===document.querySelector('aside'),animated:[...root.querySelectorAll('*')].some(e=>getComputedStyle(e).animationName!=='none'),dark:[...root.querySelectorAll('*')].some(e=>{const c=getComputedStyle(e).backgroundColor.match(/[\\d.]+/g);return c&&c.length===3&&c.slice(0,3).every(n=>Number(n)<100)}),headerStable:document.querySelector('header').getBoundingClientRect().x===window.__uiShellBox.x}})()`);
        assert(!result.pageOverflow && result.headerRetained && result.sidebarRetained && result.headerStable && !result.animated && !result.dark); skeletons.push({ width, kind, ...result }); save('skeleton-transitions', skeletons);
        if (width === 375) { const image = await session.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`docs/ui-batch1/after/${kind}-loading-375.png`, Buffer.from(image.data, 'base64')); }
      } finally { globalThis.__uiDelay = null; globalThis.__uiGateMode = false; for (const resolve of globalThis.__uiReleases || []) resolve(); }
      for (let i = 0; i < 200; i++) { if (await session.evaluate('!document.querySelector("main [data-wp-loading]")')) break; await pause(40); }
      assert.equal(await session.evaluate('window.__uiErrors?.length || 0'), 0);
    }
    for (const [route, title] of [['/dashboard/hiring/jobs/new', 'Create New Job Posting'], [`/dashboard/hiring/jobs/ui-job-060-${org.id}`, 'UI Position 060'], [`/dashboard/hiring/jobs/ui-job-060-${org.id}/edit`, 'Edit Job Posting']]) {
      await goto(route, title);
      if (await session.evaluate('document.documentElement.scrollWidth>innerWidth')) {
        save('related-overflow', { route, width, nodes: await session.evaluate(`([...document.querySelectorAll('main *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})))`) });
      }
      assert.equal(await session.evaluate('document.documentElement.scrollWidth>innerWidth'), false, `${route} overflow ${width}`);
      assert.equal(await session.evaluate('window.__uiErrors?.length || 0'), 0);
    }
  }
  save('skeleton-transitions', skeletons); ok(true, 'Ten actual route-transition skeletons stay light and static, preserve shell and fit all widths, including reduced motion');
  ok(true, 'Job detail, creation and edit screens fit all five widths without console/runtime errors');
};

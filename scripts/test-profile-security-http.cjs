/* eslint-disable @typescript-eslint/no-require-imports -- Actual production HTTP assertions; rollback fixtures only. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
module.exports = async function test({ tx, org, foreign, users, primary, candidate, tenantHost, port, session, protectedReads, sessionReads, save, ok }) {
  const { SignJWT, decodeJwt } = await import('jose');
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
  const token = session.cookie.split(';').map(x => x.trim()).find(x => x.startsWith('__Host-workpulse_session=')).split('=').slice(1).join('=');
  const claims = decodeJwt(token);
  const sign = async (changes = {}, expires = '5m') => '__Host-workpulse_session=' + await new SignJWT({ ...claims, ...changes }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expires).sign(secret);
  const profile = '/dashboard/employees/' + primary.employee.id;
  const markers = ['FR-Primary', 'Regression Primary', primary.employee.email, '09000000000', 'Regression required task', 'Complete regression cover letter'];
  const rows = [];
  const storageKey = 'profile-security-' + org.id + '.pdf';
  const filePath = path.resolve('storage/resumes', storageKey);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'ISOLATED-PRIVATE-DOCUMENT-' + org.id, { flag: 'wx' });
  try {
  const resume = await tx.document.create({ data: { applicantId: primary.employee.applicantId, applicationId: primary.application.id, fileName: 'private-fixture.pdf', fileType: 'application/pdf', fileSize: 32, storageKey } });
  const recruitment = await tx.recruitmentDocument.create({ data: { applicationId: primary.application.id, type: 'OTHER', title: 'Private fixture', fileName: 'private-fixture.pdf', fileType: 'application/pdf', storageKey } });
  const onboarding = await tx.onboardingProcess.findUniqueOrThrow({ where: { applicationId: primary.application.id }, include: { tasks: true } });
  const task = await tx.onboardingTask.update({ where: { id: onboarding.tasks[0].id }, data: { storageKey, fileName: 'private-fixture.pdf' } });
  const documentRoutes = ['/api/resumes/' + resume.id, '/api/recruitment-documents/' + recruitment.id, '/api/onboarding-documents/' + task.id];
  async function documents(label, cookie, allowed, host = tenantHost) {
    for (const route of documentRoutes) {
      const response = await fetch(`http://127.0.0.1:${port}${route}?appId=${primary.application.id}`, { redirect: 'manual', headers: { host: `${host}:${port}`, 'x-forwarded-host': `${host}:${port}`, cookie } });
      const body = await response.text();
      const row = { label: label + ' ' + route.split('/')[2], status: response.status, cacheControl: response.headers.get('cache-control'), privateDocumentPresent: body.includes('ISOLATED-PRIVATE-DOCUMENT-') };
      rows.push(row); save('responses', rows);
      if (allowed) { assert.equal(response.status, 200); assert(row.privateDocumentPresent); assert(row.cacheControl.includes('no-store')); }
      else { assert([401, 403].includes(response.status)); assert(!row.privateDocumentPresent); }
      ok(true, row.label);
    }
  }
  async function request(label, route = profile, options = {}) {
    const reads = protectedReads.length, authReads = sessionReads.length, start = performance.now();
    const url = new URL(`http://127.0.0.1:${port}${route}`);
    // Next 16 validates the RSC cache-busting parameter against its headers.
    // A missing hash merely redirects before reaching the application guard.
    if (options.rsc) url.searchParams.set('_rsc', await require('next/dist/shared/lib/router/utils/cache-busting-search-param').computeCacheBustingSearchParam(options.prefetch ? '1' : undefined, undefined, undefined, undefined));
    const response = await fetch(url, { redirect: 'manual', headers: { host: `${options.host || tenantHost}:${port}`, 'x-forwarded-host': `${options.host || tenantHost}:${port}`, cookie: options.cookie ?? session.cookie, ...(options.rsc ? { rsc: '1' } : {}), ...(options.prefetch ? { 'next-router-prefetch': '1' } : {}) } });
    const body = await response.text();
    const row = { label, status: response.status, location: response.headers.get('location')?.replace(/fr[a-f0-9]+(?:-other)?/g, '[fixture]') || null, contentType: response.headers.get('content-type'), cacheControl: response.headers.get('cache-control'), vary: response.headers.get('vary'), completedMs: Math.round(performance.now() - start), protectedReads: protectedReads.length - reads, sessionUserReads: sessionReads.length - authReads, sensitiveMarkers: markers.filter(marker => body.includes(marker)).length, redirectSignal: body.includes('NEXT_REDIRECT'), loadingShellPresent: body.includes('Loading employee profile') };
    rows.push(row); save('responses', rows);
    if (options.denied) assert(![...response.headers.values()].some(value => markers.some(marker => value.includes(marker))), label + ': response headers contain protected information');
    assert(!/\bpublic\b|s-maxage=[1-9]/i.test(row.cacheControl || ''), label + ': response must not be shared-cached');
    if (options.denied) {
      assert.equal(row.sensitiveMarkers, 0, label + ': response body contains protected information');
      assert((response.status >= 300 && response.status < 400) || (response.status === 200 && row.redirectSignal), label + ': expected server redirect');
      if (options.zeroReads !== false) assert.equal(row.protectedReads, 0, label + ': protected reads occurred before authorization');
      assert(row.location?.includes('/login') || row.location?.includes('/dashboard') || row.redirectSignal, label + ': missing redirect destination');
    }
    if (options.allowed) { assert.equal(response.status, 200); assert(body.includes(options.marker || 'FR-Primary')); if (options.rsc) assert(row.contentType.includes('text/x-component')); }
    ok(true, label);
    return { response, body, row };
  }
  for (const rsc of [false, true]) for (const tab of ['overview', 'probation', 'history', 'decisions', 'compliance', 'account']) await request(`Authorized admin ${tab} ${rsc ? 'RSC' : 'HTML'}`, profile + '?tab=' + tab, { rsc, allowed: true });
  await documents('Authorized administrator document access', session.cookie, true);
  await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'HIRING_MANAGER' } });
  const manifest = JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json'));
  const action = Object.entries(manifest.node).find(([, value]) => value.exportedName === 'regularizeEmployeeAction');
  assert(action, 'Production build must expose the real lifecycle action');
  const beforeActionReads = protectedReads.length;
  const actionResponse = await fetch(`http://127.0.0.1:${port}${profile}`, { method: 'POST', redirect: 'manual', headers: { host: `${tenantHost}:${port}`, 'x-forwarded-host': `${tenantHost}:${port}`, origin: `http://${tenantHost}:${port}`, cookie: session.cookie, 'next-action': action[0], accept: 'text/x-component', 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify([primary.employee.id, { confirmed: true, regularizationEffectiveAt: '2025-07-01' }]) });
  const actionBody = await actionResponse.text();
  const actionRow = { label: 'Stale admin real lifecycle Server Action POST', status: actionResponse.status, actionRedirect: actionResponse.headers.get('x-action-redirect'), unauthorizedResult: actionBody.includes('Unauthorized to manage employment lifecycle decisions.'), sensitiveMarkers: markers.filter(marker => actionBody.includes(marker)).length, protectedReads: protectedReads.length - beforeActionReads, decisions: await tx.employmentDecisionHistory.count({ where: { employeeId: primary.employee.id } }) };
  rows.push(actionRow); save('responses', rows);
  assert([200, 303].includes(actionRow.status)); assert(actionRow.unauthorizedResult || actionRow.actionRedirect?.includes('/login')); assert.equal(actionRow.sensitiveMarkers, 0); assert.equal(actionRow.protectedReads, 0); assert.equal(actionRow.decisions, 0);
  ok(true, actionRow.label);
  for (const rsc of [false, true]) for (const tab of ['overview', 'probation', 'history', 'decisions', 'compliance', 'account']) await request(`Stale admin denied ${tab} ${rsc ? 'RSC' : 'HTML'}`, profile + '?tab=' + tab, { rsc, denied: true });
  await request('Stale admin prefetch denied', profile, { rsc: true, prefetch: true, denied: true });
  await documents('Stale admin denied even with candidate appId', session.cookie, false);
  for (const route of ['/dashboard', '/dashboard/employees', '/dashboard/attendance/' + primary.employee.id, '/dashboard/hiring/pipeline', '/dashboard/hiring/applicants/' + candidate.id]) await request('Stale admin related route ' + route.replace(primary.employee.id, '[employee]').replace(candidate.id, '[application]'), route, { denied: true });
  const managerCookie = await sign({ role: 'HIRING_MANAGER' });
  await request('Fresh Hiring Manager cannot view Profile', profile, { cookie: managerCookie, denied: true });
  await request('Fresh Hiring Manager retains Hiring', '/dashboard/hiring/pipeline', { cookie: managerCookie, allowed: true, marker: 'Pipeline Candidate' });
  await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'HR_ADMIN' } });
  await request('Old admin rejected even after change to another allowed role', profile, { denied: true });
  await request('Fresh HR Admin legitimately accesses Profile', profile, { cookie: await sign({ role: 'HR_ADMIN' }), allowed: true });
  await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'ORGANIZATION_ADMIN' } });
  const removable = await tx.user.create({ data: { organizationId: org.id, role: 'ORGANIZATION_ADMIN', name: 'Removable fixture', email: 'removed-' + org.id + '@fixture.invalid' } });
  const removableCookie = await sign({ userId: removable.id });
  await request('Existing isolated user token works before membership removal', profile, { cookie: removableCookie, allowed: true });
  await tx.user.delete({ where: { id: removable.id } });
  await request('Same token rejected after isolated user removal', profile, { cookie: removableCookie, denied: true });
  for (const [label, cookie] of [['Expired token', await sign({}, '-1h')], ['Invalid signature', '__Host-workpulse_session=' + token.slice(0, -12) + 'invalid-sign'], ['Malformed token', '__Host-workpulse_session=invalid'], ['Missing token', ''], ['Invalid claim types', await sign({ userId: 123 })], ['Nonexistent user (revoked membership)', await sign({ userId: 'deleted-fixture-user' })]]) {
    await request(label + ' HTML', profile, { cookie, denied: true });
    await request(label + ' RSC', profile, { cookie, rsc: true, denied: true });
  }
  await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { organizationId: foreign.id } });
  await request('Old membership JWT rejected after organization transfer', profile, { denied: true });
  await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { organizationId: org.id } });
  for (const rsc of [false, true]) await request('Tenant host mismatch denied ' + (rsc ? 'RSC' : 'HTML'), profile, { host: foreign.slug + '.localhost', rsc, denied: true });
  await documents('Wrong tenant host denied document access', session.cookie, false, foreign.slug + '.localhost');
  await documents('Malformed staff cookie cannot fall through to candidate', '__Host-workpulse_session=invalid', false);
  const foreignJob = await tx.job.findFirstOrThrow({ where: { organizationId: foreign.id } });
  const foreignApplicant = await tx.applicant.create({ data: { firstName: 'FOREIGN-PRIVATE', lastName: 'IDENTITY', email: 'foreign-' + org.id + '@fixture.invalid', phone: '09000000002' } });
  const foreignApplication = await tx.application.create({ data: { applicantId: foreignApplicant.id, jobId: foreignJob.id, status: 'HIRED', coverLetter: 'FOREIGN-PRIVATE COVER LETTER' } });
  const foreignEmployee = await tx.employee.create({ data: { organizationId: foreign.id, applicantId: foreignApplicant.id, sourceApplicationId: foreignApplication.id, employeeNumber: 'FOREIGN-PRIVATE', firstName: foreignApplicant.firstName, lastName: foreignApplicant.lastName, email: foreignApplicant.email, phone: foreignApplicant.phone, createdById: users.HR_ADMIN.id } });
  for (const rsc of [false, true]) {
    const result = await request('Foreign employee ID hidden ' + (rsc ? 'RSC' : 'HTML'), '/dashboard/employees/' + foreignEmployee.id, { rsc });
    assert(!result.body.includes('FOREIGN-PRIVATE') && !result.body.includes(foreignApplicant.email));
    assert(result.response.status === 404 || result.body.includes('NEXT_HTTP_ERROR_FALLBACK;404'));
  }
  const absent = await request('Missing employee error state', '/dashboard/employees/does-not-exist');
  // A streamed not-found boundary may retain HTTP 200 after the shell flushes.
  assert(absent.response.status === 404 || absent.body.includes('NEXT_HTTP_ERROR_FALLBACK;404'));
  await request('Profile recovers after denial and not-found without stale request cache', profile, { allowed: true });
  await request('Dashboard retains permitted access', '/dashboard', { allowed: true, marker: 'Welcome Back,' });
  await request('Hiring retains permitted access', '/dashboard/hiring/pipeline', { allowed: true, marker: 'Pipeline Candidate' });
  // Separate, pre-existing candidate authorization policy: appId itself is
  // accepted as a bearer capability, even without a staff cookie. Record this
  // risk explicitly rather than labelling it a successful security restriction.
  const candidateChecks = [];
  for (const route of documentRoutes.slice(1)) {
    const response = await fetch(`http://127.0.0.1:${port}${route}?appId=${primary.application.id}`, { redirect: 'manual', headers: { host: `${tenantHost}:${port}`, 'x-forwarded-host': `${tenantHost}:${port}` } });
    candidateChecks.push({ endpoint: route.split('/')[2], status: response.status, matchingApplicationIdentifierAloneReturnsFile: (await response.text()).includes('ISOLATED-PRIVATE-DOCUMENT-') });
  }
  save('candidate-access-risk', { separateFromStaffSessionRegression: true, requiresDocumentAndApplicationIdentifiers: true, results: candidateChecks });
  save('policy', { roleChangesRequireFreshLogin: true, roleRestorationMakesSameClaimsValidAgain: true, perTokenRevocationBlacklistSupported: false, currentMembershipVerified: true, jwtExpiryAndSignatureVerified: true, testsInspectWholeBodies: true, htmlAndRsc: true, secretOrBodiesSaved: false });
  } finally {
    // This path is the uniquely named fixture file created above with exclusive
    // creation. Never enumerate or delete an existing upload directory.
    assert(filePath.startsWith(path.resolve('storage/resumes') + path.sep));
    fs.unlinkSync(filePath);
  }
};

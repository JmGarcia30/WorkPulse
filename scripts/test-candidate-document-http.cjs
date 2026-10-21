/* eslint-disable @typescript-eslint/no-require-imports -- Real HTTP/actions/browser using rollback-only synthetic records. */
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { encodeReply } = require('next/dist/compiled/react-server-dom-webpack/client.edge');
const { ApplicationStatus } = require('@prisma/client');
module.exports = async function test({ tx, org, foreign, users, primary, otherJob, candidate, tenantHost, port, session, save, ok }) {
  const { SignJWT } = await import('jose');
  const manifest = JSON.parse(fs.readFileSync('.next/server/server-reference-manifest.json'));
  const rows = [], risks = [], ownedPaths = new Set();
  const base = `http://127.0.0.1:${port}`;
  const marker = 'CANDIDATE-PRIVATE-FIXTURE-' + org.id;
  const file = () => new File([marker.padEnd(2048, '.')], 'isolated-review.pdf', { type: 'application/pdf' });
  const form = () => { const data = new FormData(); data.set('file', file()); return data; };
  const token = async (user, role = user.role) => '__Host-workpulse_session=' + await new SignJWT({ userId: user.id, organizationId: user.organizationId, role, name: user.name, email: user.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const headers = (cookie = session.cookie, host = tenantHost) => ({ host: `${host}:${port}`, 'x-forwarded-host': `${host}:${port}`, cookie });
  const record = row => { rows.push(row); save('responses', rows); };
  async function rememberFiles() {
    for (const doc of await tx.recruitmentDocument.findMany({ where: { applicationId: { in: applicationIds } }, select: { storageKey: true } })) if (doc.storageKey && !doc.storageKey.startsWith('candidate-review-missing-')) ownedPaths.add(path.resolve('storage/resumes', doc.storageKey));
    for (const item of await tx.onboardingTask.findMany({ where: { onboardingProcess: { applicationId: primary.application.id } }, select: { storageKey: true } })) if (item.storageKey) ownedPaths.add(path.resolve('storage/resumes', item.storageKey));
  }
  const applicantRoute = '/dashboard/hiring/applicants/' + primary.application.id + '?tab=documents';
  const portalRoute = `/careers/${org.slug}/portal/${primary.application.id}`;
  const applicationIds = [primary.application.id, candidate.id];
  async function action(name, args, options = {}) {
    await rememberFiles();
    const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
    assert(entry, 'Missing real Server Action: ' + name);
    const host = options.host || tenantHost, body = await encodeReply(args);
    const response = await fetch(base + (options.route || (options.portal ? portalRoute : applicantRoute)), { method: 'POST', redirect: 'manual', headers: { ...headers(options.cookie ?? session.cookie, host), origin: `http://${host}:${port}`, 'next-action': entry[0], accept: 'text/x-component', ...(typeof body === 'string' ? { 'content-type': 'text/plain;charset=UTF-8' } : {}) }, body });
    const text = await response.text();
    await rememberFiles();
    record({ action: name, status: response.status, returnedError: /"error"|Unauthorized|access denied|cannot be replaced|cannot accept/.test(text), containsFixtureIdentity: text.includes(primary.employee.email) });
    return text;
  }
  async function download(label, route, options = {}) {
    const response = await fetch(base + route, { headers: headers(options.cookie ?? session.cookie, options.host || tenantHost), redirect: 'manual' });
    const text = await response.text();
    const row = { label, status: response.status, cacheControl: response.headers.get('cache-control'), nosniff: response.headers.get('x-content-type-options'), containsPrivateBytes: text.includes(marker), containsIdentity: text.includes(primary.employee.email) };
    record(row);
    if (options.allow) { assert.equal(response.status, 200); assert(row.containsPrivateBytes); assert(row.cacheControl.includes('no-store')); assert.equal(row.nosniff, 'nosniff'); }
    else { assert([401, 403, 404].includes(response.status)); assert(!row.containsPrivateBytes && !row.containsIdentity); assert(!response.headers.get('location')); }
    ok(true, label);
    return row;
  }
  const localKey = 'candidate-review-' + org.id + '.pdf';
  const ownPath = path.resolve('storage/resumes', localKey); ownedPaths.add(ownPath);
  fs.mkdirSync(path.dirname(ownPath), { recursive: true }); fs.writeFileSync(ownPath, marker, { flag: 'wx' });
  let recruitment, task, resume;
  try {
    recruitment = await tx.recruitmentDocument.create({ data: { applicationId: primary.application.id, type: 'OTHER', title: 'Isolated candidate review', status: 'SUBMITTED', fileName: 'isolated.pdf', storageKey: localKey } });
    resume = await tx.document.create({ data: { applicationId: primary.application.id, applicantId: primary.employee.applicantId, fileName: 'isolated.pdf', fileType: 'application/pdf', fileSize: marker.length, storageKey: localKey } });
    const onboardingProcess = await tx.onboardingProcess.findUniqueOrThrow({ where: { applicationId: primary.application.id }, include: { tasks: true } });
    task = await tx.onboardingTask.update({ where: { id: onboardingProcess.tasks[0].id }, data: { status: 'SUBMITTED', storageKey: localKey, fileName: 'isolated.pdf', fileType: 'application/pdf' } });
    if (process.env.FR_DELETED_DOCUMENTS === '1') {
      await tx.recruitmentDocument.delete({ where: { id: recruitment.id } });
      await download('Deleted fixture document returns safe not-found', '/api/recruitment-documents/' + recruitment.id);
      const orphan = await tx.document.create({ data: { applicantId: primary.employee.applicantId, fileName: 'orphan-fixture.pdf', fileType: 'application/pdf', fileSize: 10, storageKey: localKey } });
      await download('Resume without owning application cannot be retrieved', '/api/resumes/' + orphan.id);
      await tx.onboardingTask.update({ where: { id: task.id }, data: { storageKey: null } });
      await download('Task without uploaded file is safe not-found', '/api/onboarding-documents/' + task.id);
      return;
    }
    const otherDocument = await tx.recruitmentDocument.create({ data: { applicationId: candidate.id, type: 'OTHER', title: 'Other candidate requirement', storageKey: localKey } });
    const foreignApplicant = await tx.applicant.create({ data: { firstName: 'FOREIGN-PRIVATE', lastName: 'Fixture', email: 'candidate-review-' + org.id + '@fixture.invalid', phone: '09000000009' } });
    const foreignApp = await tx.application.create({ data: { jobId: otherJob.id, applicantId: foreignApplicant.id, coverLetter: 'FOREIGN-PRIVATE' } }); applicationIds.push(foreignApp.id);
    const foreignDoc = await tx.recruitmentDocument.create({ data: { applicationId: foreignApp.id, type: 'OTHER', title: 'Foreign fixture requirement', fileName: 'isolated.pdf', storageKey: localKey } });
    const routes = ['/api/resumes/' + resume.id, '/api/recruitment-documents/' + recruitment.id, '/api/onboarding-documents/' + task.id];
    for (const role of ['ORGANIZATION_ADMIN', 'HR_ADMIN', 'HIRING_MANAGER']) for (const route of routes) await download(role + ' permitted document', route, { cookie: await token(users[role]), allow: true });
    for (const route of routes) {
      await download('Employee denied', route, { cookie: await token(users.EMPLOYEE) });
      await download('No credentials denied', route, { cookie: '' });
      await download('Invalid staff cookie cannot use appId', route + '?appId=' + primary.application.id, { cookie: '__Host-workpulse_session=invalid' });
      await download('Wrong tenant staff denied', route, { host: foreign.slug + '.localhost' });
    }
    await download('Staff may read another candidate in same organization', '/api/recruitment-documents/' + otherDocument.id, { allow: true });
    await download('Changed ID cannot retrieve foreign document', '/api/recruitment-documents/' + foreignDoc.id);
    await download('Anonymous foreign tenant cannot override host with appId', routes[1] + '?appId=' + primary.application.id, { cookie: '', host: foreign.slug + '.localhost' });
    await download('Unprovisioned tenant cannot fall back to public careers access', routes[1] + '?appId=' + primary.application.id, { cookie: '', host: org.slug + '-unknown.localhost' });
    await download('Mismatched candidate application and document IDs denied', '/api/recruitment-documents/' + otherDocument.id + '?appId=' + primary.application.id, { cookie: '' });
    for (const route of ['/api/resumes/missing', '/api/recruitment-documents/missing', '/api/onboarding-documents/missing']) await download('Missing record safe', route);
    await tx.recruitmentDocument.update({ where: { id: recruitment.id }, data: { storageKey: 'candidate-review-missing-' + org.id + '.pdf' } });
    await download('Inaccessible stored file safe', routes[1]);
    await tx.recruitmentDocument.update({ where: { id: recruitment.id }, data: { storageKey: localKey } });
    await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'EMPLOYEE' } });
    for (const route of routes) await download('Role downgrade rejects old JWT', route);
    await tx.user.update({ where: { id: users.ORGANIZATION_ADMIN.id }, data: { role: 'ORGANIZATION_ADMIN' } });

    // Established staff permissions: real multipart Server Actions and database assertions.
    await action('uploadRecruitmentDocumentAction', [recruitment.id, form()], { cookie: await token(users.HIRING_MANAGER) });
    let current = await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } });
    assert(current.storageKey !== localKey && current.status === 'SUBMITTED'); ok(true, 'Hiring Manager recruitment upload persists');
    const unchanged = current.storageKey;
    await action('uploadRecruitmentDocumentAction', [recruitment.id, form()], { host: foreign.slug + '.localhost' });
    assert.equal((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } })).storageKey, unchanged); ok(true, 'Wrong request tenant prevents staff mutation');
    await action('uploadRecruitmentDocumentAction', [foreignDoc.id, form()]);
    assert.equal((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: foreignDoc.id } })).storageKey, localKey); ok(true, 'Foreign document ID prevents staff mutation');
    await action('uploadOnboardingTaskDocumentAction', [task.id, form()], { cookie: await token(users.HIRING_MANAGER) });
    assert.equal((await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).storageKey, localKey); ok(true, 'Hiring Manager cannot upload onboarding');
    await action('uploadOnboardingTaskDocumentAction', [task.id, form()]);
    assert.notEqual((await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).storageKey, localKey); ok(true, 'Administrator onboarding upload persists');
    await action('verifyRecruitmentDocumentAction', [recruitment.id, 'Synthetic review']);
    current = await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } });
    assert.equal(current.status, 'VERIFIED'); assert.equal(current.verifiedById, users.ORGANIZATION_ADMIN.id); ok(true, 'Verification records real persisted reviewer');
    await action('submitCandidateRecruitmentDocumentAction', [org.slug, primary.application.id, recruitment.id, form()], { portal: true, cookie: '' });
    assert.equal((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } })).storageKey, current.storageKey); ok(true, 'Direct candidate action cannot overwrite verified file');
    await action('rejectRecruitmentDocumentAction', [recruitment.id, 'Synthetic request for resubmission']);
    assert.equal((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } })).status, 'REJECTED'); ok(true, 'Rejection persists reviewer feedback');
    await action('submitCandidateRecruitmentDocumentAction', [org.slug, primary.application.id, recruitment.id, form()], { portal: true, cookie: '', host: foreign.slug + '.localhost' });
    assert.equal((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } })).status, 'REJECTED'); ok(true, 'Wrong tenant prevents candidate upload');
    const unsafeFile = new FormData(); unsafeFile.set('file', new File(['<script>/* synthetic */</script>'.padEnd(2048, '.')], 'disguised.pdf', { type: 'text/html' }));
    await action('submitCandidateRecruitmentDocumentAction', [org.slug, primary.application.id, recruitment.id, unsafeFile], { portal: true, cookie: '' });
    assert.equal((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } })).status, 'REJECTED'); ok(true, 'Active HTML MIME cannot bypass validation with PDF extension');
    // Current ownership policy is unresolved. Do not count this exposure as an authorization pass.
    await action('submitCandidateRecruitmentDocumentAction', [org.slug, primary.application.id, recruitment.id, form()], { portal: true, cookie: '' });
    current = await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } });
    risks.push({ path: 'candidate recruitment upload', matchingIdsWithoutCandidateCredentialCanWrite: current.status === 'SUBMITTED' });
    await tx.onboardingTask.update({ where: { id: task.id }, data: { status: 'VERIFIED' } });
    const beforeTask = await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } });
    await action('submitCandidateOnboardingDocumentAction', [org.slug, primary.application.id, task.id, form()], { portal: true, cookie: '' });
    assert.equal((await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).storageKey, beforeTask.storageKey); ok(true, 'Direct candidate action cannot overwrite verified onboarding file');
    await tx.onboardingTask.update({ where: { id: task.id }, data: { status: 'WAIVED' } });
    await action('submitCandidateOnboardingDocumentAction', [org.slug, primary.application.id, task.id, form()], { portal: true, cookie: '' });
    assert.equal((await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).status, 'WAIVED'); ok(true, 'Waived onboarding file remains unchanged');
    await tx.onboardingTask.update({ where: { id: task.id }, data: { status: 'PENDING', type: 'ORIENTATION' } });
    await action('submitCandidateOnboardingDocumentAction', [org.slug, primary.application.id, task.id, form()], { portal: true, cookie: '' });
    assert.equal((await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).status, 'PENDING'); ok(true, 'Non-document task cannot be completed via document upload');
    await tx.onboardingTask.update({ where: { id: task.id }, data: { type: 'DOCUMENT', status: 'PENDING' } });
    await action('submitCandidateOnboardingDocumentAction', [org.slug, primary.application.id, task.id, unsafeFile], { portal: true, cookie: '' });
    assert.equal((await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).status, 'PENDING'); ok(true, 'Onboarding upload also rejects disguised HTML');
    await action('submitCandidateOnboardingDocumentAction', [org.slug, primary.application.id, task.id, form()], { portal: true, cookie: '' });
    risks.push({ path: 'candidate onboarding upload', matchingIdsWithoutCandidateCredentialCanWrite: (await tx.onboardingTask.findUniqueOrThrow({ where: { id: task.id } })).status === 'SUBMITTED' });
    const portalData = await action('getCandidatePortalData', [org.slug, primary.application.id], { portal: true, cookie: '' });
    risks.push({ path: 'candidate portal data Server Action', matchingIdsExposeIdentityWithoutCandidateCredential: portalData.includes(primary.employee.email) });
    for (const route of routes.slice(1)) {
      const response = await fetch(base + route + '?appId=' + primary.application.id, { headers: headers('') });
      risks.push({ path: route.split('/')[2], matchingIdsReturnFileWithoutCandidateCredential: (await response.text()).includes(marker), status: response.status });
    }
    const mismatch = await fetch(base + portalRoute, { headers: headers('', foreign.slug + '.localhost'), redirect: 'manual' });
    const mismatchBody = await mismatch.text(); assert(!mismatchBody.includes('Regression Primary') && !mismatchBody.includes(primary.employee.email)); ok(true, 'Foreign-host portal HTML and metadata contain no candidate identity');
    for (const status of Object.values(ApplicationStatus)) {
      await tx.application.update({ where: { id: primary.application.id }, data: { status } });
      await download('Staff historical read after ' + status, routes[1], { allow: true });
    }
    await tx.application.update({ where: { id: primary.application.id }, data: { status: 'HIRED' } });
    for (const route of ['/storage/resumes/' + localKey, '/' + localKey]) await download('Raw local storage URL cannot bypass handler', route, { cookie: '' });

    // Public application is another upload path. Probe only this run's new
    // applicant: caller-supplied email currently authorizes a shared identity update.
    await tx.job.update({ where: { id: otherJob.id }, data: { status: 'PUBLISHED' } });
    const applicationForm = new FormData();
    for (const [key, value] of Object.entries({ jobId: otherJob.id, organizationSlug: foreign.slug, firstName: 'UNVERIFIED-MODIFICATION', lastName: 'Synthetic', email: primary.employee.email, phone: '09000000008', coverLetter: 'Isolated application ownership probe' })) applicationForm.set(key, value);
    applicationForm.set('resume', file());
    await action('submitApplicationAction', [applicationForm], { cookie: '', host: foreign.slug + '.localhost', route: `/careers/${foreign.slug}/${otherJob.slug}/apply` });
    const reapplied = await tx.application.findUniqueOrThrow({ where: { jobId_applicantId: { jobId: otherJob.id, applicantId: primary.employee.applicantId } }, include: { documents: true, applicant: true } });
    applicationIds.push(reapplied.id); await rememberFiles();
    assert.equal(reapplied.documents.length, 1); ok(true, 'Public application stores resume against its new application');
    risks.push({ path: 'public initial application', suppliedEmailWithoutOwnershipProofChangesSharedApplicantIdentityAcrossOrganizations: reapplied.applicant.firstName === 'UNVERIFIED-MODIFICATION' });
    await download('New public-upload resume remains isolated from foreign staff organization', '/api/resumes/' + reapplied.documents[0].id);
    const foreignReader = await tx.user.create({ data: { organizationId: foreign.id, role: 'HR_ADMIN', name: 'Synthetic foreign reviewer', email: 'foreign-reader-' + org.id + '@fixture.invalid' } });
    await download('Authorized organization can read its public application upload', '/api/resumes/' + reapplied.documents[0].id, { cookie: await token(foreignReader), host: foreign.slug + '.localhost', allow: true });

    // Actual browser file selection/change workflow, not an action stub.
    await session.send('Page.navigate', { url: `http://${tenantHost}:${port}${applicantRoute}` });
    for (let i = 0; i < 150; i++) { if (await session.evaluate(`!!document.querySelector('button[aria-label="More options"]')`)) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert(await session.evaluate(`!!document.querySelector('a[href="${routes[1]}"]')`)); ok(true, 'Browser recruitment preview link uses authorized endpoint');
    await new Promise(resolve => setTimeout(resolve, 500));
    await session.evaluate(`document.querySelector('button[aria-label="More options"]').click();true`);
    for (let i = 0; i < 100; i++) { if (await session.evaluate(`!!document.querySelector('input[type=file]')`)) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
    assert(nodeId); await session.send('DOM.setFileInputFiles', { nodeId, files: [ownPath] });
    let browserSaved = false;
    for (let i = 0; i < 150; i++) { if ((await tx.recruitmentDocument.findUniqueOrThrow({ where: { id: recruitment.id } })).fileName === path.basename(ownPath)) { browserSaved = true; break; } await new Promise(resolve => setTimeout(resolve, 100)); }
    assert(browserSaved); ok(true, 'Browser staff upload persists replacement through real form');
    const browserDownload = await session.evaluate(`(async()=>{const response=await fetch('${routes[1]}');return {status:response.status,noStore:response.headers.get('cache-control')?.includes('no-store'),bytesMatch:(await response.text()).includes(${JSON.stringify(marker)})}})()`);
    assert(browserDownload.status === 200 && browserDownload.noStore && browserDownload.bytesMatch); ok(true, 'Browser preview/download receives exact uploaded fixture bytes');
    save('open-policy-exposures', { candidateOwnershipProofMissing: true, secureAcrossAllPaths: false, findings: risks, liveBlobAndEmailTested: false });
  } finally {
    // Only keys belonging to this run's new fixture applications are removed.
    await rememberFiles();
    for (const ownedPath of ownedPaths) { assert(ownedPath.startsWith(path.resolve('storage/resumes') + path.sep)); if (fs.existsSync(ownedPath)) fs.unlinkSync(ownedPath); }
  }
};

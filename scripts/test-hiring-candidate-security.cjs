/* eslint-disable @typescript-eslint/no-require-imports -- Candidate security with controlled in-memory dependencies. */
// Current application code with in-memory dependencies: no database or mail access.
const assert = require('node:assert/strict'), Module = require('node:module');
require('tsx/cjs');
const original = Module._load, jar = new Map();
let row, tenant = true, delivery = true, token, sends = 0, options, privateReads = 0, updates = 0, duplicate = false;
const identity = { id: 'owner', firstName: 'Owner', lastName: 'Fixture', email: 'owner@fixture.invalid', phone: '09000000000' };
const application = { id: 'app-one', status: 'APPLIED', applicant: identity, job: { category: 'NON_TEACHING', organizationId: 'org-one', organization: { slug: 'fixture', name: 'Fixture' } }, recruitmentDocuments: [] };
const job = { id: 'job-one', slug: 'fixture-job', status: 'PUBLISHED', category: 'NON_TEACHING', organization: { slug: 'fixture', name: 'Fixture', careersEnabled: true } };
const db = {
  job: { findUnique: async () => job },
  applicant: { findFirst: async () => identity, update: async () => { updates++; throw Error('IDENTITY_UPDATE_FORBIDDEN'); } },
  application: { findFirst: async () => { privateReads++; return application; }, findUnique: async () => duplicate ? application : null, create: async () => application },
  candidateAccess: {
    upsert: async ({ create }) => row ||= { ...create, lastSentAt: null, windowStartedAt: new Date(), sendCount: 0, revoked: false },
    findUniqueOrThrow: async () => row,
    update: async ({ data }) => Object.assign(row, data),
    findFirst: async ({ where }) => {
      assert(where.revoked === false && where.sessionExpiresAt.gt instanceof Date);
      assert.deepEqual(where.application.status.notIn, ['REJECTED', 'WITHDRAWN']);
      return row && where.applicationId === 'app-one' && where.sessionHash === row.sessionHash && !row.revoked && row.sessionExpiresAt > new Date() && !['REJECTED', 'WITHDRAWN'].includes(application.status) ? applicationGrant() : null;
    },
    updateMany: async ({ where, data }) => {
      if (!row || row.revoked || where.linkHash !== row.linkHash) return { count: 0 };
      if (where.delivered === true) {
        assert(where.linkExpiresAt.gt instanceof Date && where.application.job.organization.slug === 'fixture');
        if (!row.delivered || row.linkExpiresAt <= new Date()) return { count: 0 };
      }
      Object.assign(row, data); return { count: 1 };
    },
  },
  $queryRaw: async () => [],
  $transaction: async fn => fn(db),
};
const applicationGrant = () => ({ application: { job: { organizationId: 'org-one' } } });
Module._load = function (name, parent, main) {
  if (name === '@/features/hiring/document-requirements') return { ensureRecruitmentDocumentsExist: async () => [] };
  if (name === 'server-only') return {};
  if (name === '@/lib/db/prisma') return { prisma: db };
  if (name === '@/lib/auth/session') return { COOKIE_NAME: '__Host-workpulse_session', getSession: async () => null };
  if (name === '@/features/hiring/document-access') return { candidatePortalMatchesRequestTenant: async () => tenant, candidateDocumentMatchesRequestTenant: async () => tenant, safeCandidateDocumentContentType: x => x };
  if (name === '@/features/hiring/saga-requirements') return { ensureRecruitmentDocumentsExist: async () => {}, areRecruitmentDocumentsSatisfied: () => ({ isSatisfied: false }) };
  if (name === '@/lib/storage') return { localStorageProvider: { upload: async () => { throw Error('NO_FILE_WRITES'); } } };
  if (name === '@/lib/email') return { sendEmail: async input => { sends++; assert(input.sensitive); token = input.text.match(/#token=([a-f0-9]{64})/)[1]; return { success: delivery, mode: delivery ? 'smtp' : 'preview_log' }; } };
  if (name === 'next/headers') return { cookies: async () => ({ has: n => jar.has(n), get: n => jar.has(n) ? { value: jar.get(n) } : undefined, set: (n, v, o) => { jar.set(n, v); options = o; } }) };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  if (name === 'next/navigation') return { redirect: path => { const error = Error('REDIRECT'); error.path = path; throw error; } };
  return original.call(this, name, parent, main);
};
(async () => {
  const access = require('../src/features/careers/candidate-access.ts');
  const portal = require('../src/features/careers/portal-actions.ts');
  assert.equal(await access.candidateHasAccess('app-one', 'fixture'), false);
  assert.equal(await portal.getCandidatePortalData('fixture', 'app-one'), null);
  assert((await portal.submitCandidateRecruitmentDocumentAction('fixture', 'app-one', 'doc-one', new FormData())).error);
  assert((await portal.submitCandidateOnboardingDocumentAction('fixture', 'app-one', 'task-one', new FormData())).error);
  assert.equal(privateReads, 0); console.log('PASS anonymous portal and both upload actions deny before private reads');
  await access.issueCandidateLink('fixture', 'app-one', 'wrong@fixture.invalid'); assert.equal(sends, 0);
  await access.issueCandidateLink('fixture', 'app-one', identity.email);
  assert.equal(row.linkHash, access.hashCredential(token)); assert(!JSON.stringify(row).includes(token));
  assert.equal(row.linkExpiresAt - row.lastSentAt, 900000);
  const first = token; await access.issueCandidateLink('fixture', 'app-one', identity.email); assert.equal(sends, 1);
  row.lastSentAt = new Date(Date.now() - 61000); row.sendCount = 5;
  await access.issueCandidateLink('fixture', 'app-one', identity.email); assert.equal(sends, 1);
  row.linkExpiresAt = new Date(Date.now() - 1); assert.equal(await access.consumeCandidateLink('fixture', 'app-one', first), false);
  row = undefined; delivery = false; await access.issueCandidateLink('fixture', 'app-one', identity.email); assert.equal(row.linkHash, null);
  assert.equal(await access.consumeCandidateLink('fixture', 'app-one', token), false);
  console.log('PASS hashed fifteen-minute links, rate limits, expiry and failed delivery deny access');
  row = undefined; delivery = true; await access.issueCandidateLink('fixture', 'app-one', identity.email);
  tenant = false; assert.equal(await access.consumeCandidateLink('fixture', 'app-one', token), false); tenant = true;
  assert(await access.consumeCandidateLink('fixture', 'app-one', token)); assert.equal(await access.consumeCandidateLink('fixture', 'app-one', token), false);
  assert(options.httpOnly && options.secure && options.sameSite === 'lax' && options.path === '/' && options.maxAge === 86400);
  assert(await access.candidateHasAccess('app-one', 'fixture')); assert.equal(await access.candidateHasAccess('foreign-app', 'fixture'), false);
  tenant = false; assert.equal(await access.candidateHasAccess('app-one', 'fixture'), false); tenant = true;
  jar.set('__Host-workpulse_session', 'invalid'); assert.equal(await access.candidateHasAccess('app-one', 'fixture'), false); jar.delete('__Host-workpulse_session');
  row.revoked = true; assert.equal(await access.candidateHasAccess('app-one', 'fixture'), false); row.revoked = false;
  row.sessionExpiresAt = new Date(Date.now() - 1); assert.equal(await access.candidateHasAccess('app-one', 'fixture'), false);
  console.log('PASS successful one-time exchange, secure twenty-four-hour cookie, application/tenant binding, invalid staff fallback, revoked/expired session denial');
  jar.clear(); row = undefined; const submit = require('../src/features/careers/actions.ts').submitApplicationAction;
  const form = new FormData(); for (const [k, v] of Object.entries({ jobId: 'job-one', organizationSlug: 'fixture', firstName: 'Unverified', lastName: 'Overwrite', email: identity.email, phone: 'attacker-phone', coverLetter: 'Fixture' })) form.set(k, v);
  for (const repeat of [false, true]) { duplicate = repeat; await assert.rejects(submit(form), error => error.message === 'REDIRECT' && error.path.endsWith('?success=true') && !error.path.includes('appId=')); }
  assert.equal(updates, 0); assert.equal(identity.firstName, 'Owner'); assert.equal(identity.phone, '09000000000');
  console.log('PASS unverified existing-email submissions and duplicates use neutral receipt without shared identity mutation');
})().catch(error => { console.error('FAIL', error.code || error.name); process.exitCode = 1; }).finally(() => { Module._load = original; });

/* eslint-disable @typescript-eslint/no-require-imports -- Real services/actions with request adapters; all database fixtures roll back. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { hash } = require('bcryptjs');
module.exports = async function runBoundaries(db, context, setRequestDb) {
  const checks = [], files = [], rollback = Error('BOUNDARY_FIXTURE_ROLLBACK');
  const check = (value, label) => { assert(value, label); checks.push(label); console.log('BOUNDARY PASS', label); };
  try {
    await db.$transaction(async tx => {
      const fixture = new Proxy(tx, { get(target, key) { if (key === '$transaction') return work => work(tx); const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
      setRequestDb(fixture);
      const service = require('../src/features/platform-admin/service.ts');
      const actions = require('../src/features/platform-admin/actions.ts');
      const session = require('../src/features/platform-admin/session.ts');
      const marker = 'workflow-' + randomBytes(8).toString('hex'), password = randomBytes(20).toString('hex');
      const admin = await tx.platformAdministrator.create({ data: { name: 'Synthetic administrator', email: marker + '@fixture.invalid', passwordHash: await hash(password, 12) } });
      check(await service.authenticatePlatformAdministrator(fixture, admin.email, 'invalid') === null, 'platform rejects an invalid password');
      check(await service.authenticatePlatformAdministrator(fixture, marker + '-unknown@fixture.invalid', password) === null, 'platform rejects unknown accounts');
      const form = new FormData(); form.set('email', admin.email); form.set('password', password);
      await assert.rejects(() => actions.platformLoginAction({}, form), e => e.message === 'REDIRECT:/platform');
      const cookie = context.jar.get(session.PLATFORM_COOKIE);
      check(cookie?.httpOnly && cookie.sameSite === 'strict' && cookie.path === '/', 'unchanged platform login action sets its isolated secure cookie contract');
      check((await service.findPlatformAdministrator(fixture, cookie.value))?.id === admin.id, 'platform token resolves only its synthetic administrator');
      const persisted = await tx.platformAdministratorSession.findFirstOrThrow({ where: { administratorId: admin.id } });
      check(persisted.tokenHash !== cookie.value && persisted.tokenHash === service.tokenHash(cookie.value), 'only a hash of the platform session is stored');
      context.headers = new Headers({ host: 'saga.localhost:3000' });
      await assert.rejects(() => session.requirePlatformAdministrator(), e => e.message === 'NOT_FOUND');
      checks.push('platform administrator guard denies tenant hosts');
      context.headers = new Headers({ host: 'localhost:3000' });
      await assert.rejects(() => actions.platformLogoutAction(), e => e.message === 'REDIRECT:/platform/login');
      check(!context.jar.has(session.PLATFORM_COOKIE) && await service.findPlatformAdministrator(fixture, cookie.value) === null, 'logout clears platform browser and database session');
      const org = await tx.organization.create({ data: { slug: marker, name: 'Synthetic application institution', careersEnabled: true } });
      const job = await tx.job.create({ data: { organizationId: org.id, title: 'Synthetic position', slug: 'application-fixture', department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', category: 'NON_TEACHING', status: 'PUBLISHED' } });
      context.headers = new Headers({ host: marker + '.localhost:3000' });
      context.captureVerification = true; // In-memory mail sink. Tokens never leave this test process.
      const { submitApplicationAction } = require('../src/features/careers/actions.ts');
      const { PDFDocument } = require('pdf-lib');
      const pdf = await PDFDocument.create(); pdf.addPage(); const bytes = await pdf.save();
      const applicationForm = new FormData();
      for (const [key, value] of Object.entries({ jobId: job.id, organizationSlug: marker, jobSlug: job.slug, firstName: 'Synthetic', lastName: 'Applicant', email: marker + '-applicant@fixture.invalid', phone: '09170000000', coverLetter: 'Synthetic resume submission' })) applicationForm.set(key, value);
      applicationForm.set('resume', new File([bytes], 'synthetic-resume.pdf', { type: 'application/pdf' }));
      await assert.rejects(() => submitApplicationAction(applicationForm), e => e.message === 'REDIRECT:/careers/' + marker + '/' + job.slug + '/apply?success=true');
      const application = await tx.application.findFirstOrThrow({ where: { jobId: job.id }, include: { documents: true, candidateAccess: true, applicant: true } });
      files.push(...application.documents.map(document => document.storageKey));
      check(application.status === 'APPLIED' && application.applicant.firstName === 'Synthetic', 'public submission preserves the recruitment lifecycle and applicant fields');
      check(application.documents.length === 1 && application.documents[0].fileName === 'synthetic-resume.pdf' && application.documents[0].fileSize === bytes.length, 'real resume upload retains the document metadata');
      const { localStorageProvider } = require('../src/lib/storage');
      const stored = await localStorageProvider.get(application.documents[0].storageKey);
      check(Buffer.from(bytes).equals(stored.buffer), 'uploaded resume bytes can be read through the existing private storage provider');
      check(application.candidateAccess?.linkHash && application.candidateAccess.linkExpiresAt && !application.candidateAccess.sessionHash, 'submission initializes email verification without granting unverified document access');
      const { candidateHasAccess, consumeCandidateLink } = require('../src/features/careers/candidate-access.ts');
      check(!await candidateHasAccess(application.id, marker), 'unverified applicant has no candidate document access');
      const token = new URL(context.verificationUrl).hash.slice('#token='.length);
      check(await consumeCandidateLink(marker, application.id, token) && await candidateHasAccess(application.id, marker), 'the application-bound email verification link grants the existing candidate session');
      check(!await consumeCandidateLink(marker, application.id, token), 'verification link remains single-use');
      const initialApplicant = JSON.stringify(application.applicant);
      await assert.rejects(() => submitApplicationAction(applicationForm), e => e.message.endsWith('/apply?success=true'));
      check(await tx.application.count({ where: { jobId: job.id } }) === 1 && JSON.stringify(await tx.applicant.findUnique({ where: { id: application.applicantId } })) === initialApplicant, 'duplicate public submission preserves applicant ownership and identity');
      context.headers = new Headers({ host: 'different-tenant.localhost:3000' });
      check(!await candidateHasAccess(application.id, marker), 'verified candidate access is still denied on the wrong tenant host');
      await assert.rejects(() => submitApplicationAction(applicationForm), e => e.message === 'REDIRECT:/careers');
      check(await tx.application.count({ where: { jobId: job.id } }) === 1, 'wrong-tenant public submission cannot create an application');
      throw rollback;
    }, { timeout: 180000 });
  } catch (error) { if (error !== rollback) throw error; }
  finally {
    for (const key of files) await require('../src/lib/storage').localStorageProvider.delete(key);
    setRequestDb(db); context.jar.clear(); context.headers = new Headers({ host: 'localhost:3000' }); delete context.verificationUrl; context.captureVerification = false;
  }
  return { passed: true, assertions: checks.length, checks, fixturesRolledBack: true, outboundEmailDisabled: true };
};

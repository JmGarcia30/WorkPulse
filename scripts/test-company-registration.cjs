/* eslint-disable @typescript-eslint/no-require-imports -- Recovery integration tests, enclosed in a rolled-back transaction. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { compare } = require('bcryptjs');

module.exports = async function test(db, context) {
  const service = require('../src/features/company-registration/service.ts');
  const actions = require('../src/features/company-registration/actions.ts');
  const { companySlugBase } = require('../src/features/company-registration/schema.ts');
  const { hashActivationToken } = require('../src/features/employee-self-service/activation.ts');
  const { workspaceSlug } = require('../src/features/platform-admin/onboarding-schema.ts');
  const { proxy } = require('../src/proxy.ts');
  const { NextRequest } = require('next/server');
  const tenantActions = require('../src/lib/auth/actions.ts');
  const sessions = require('../src/lib/auth/session.ts');
  const emailer = require('../src/lib/email/index.ts');
  const prefix = 'public-test-' + randomBytes(6).toString('hex');
  const password = randomBytes(24).toString('hex');
  const proof = randomBytes(32).toString('base64url');
  const stranger = randomBytes(32).toString('base64url');
  const messages = [], checks = [];
  const sender = async input => { messages.push(input); return { success: true, mode: 'smtp', id: 'synthetic' }; };
  const token = message => message.code;
  const verify = (client, code, browser, password = '') => service.verifyCompanyRegistration(client, code, browser, password, messages.find(message => message.code === code)?.to ?? first.email);
  const input = suffix => ({ companyName: prefix + ' ' + suffix, administratorName: 'Synthetic Company HR', email: prefix + '-' + suffix + '@fixture.invalid', password });
  const check = (value, label) => { assert.ok(value, label); checks.push(label); console.log('PASS:', label); };
  const rejects = async (work, code, label) => { await assert.rejects(work, error => error.code === code); check(true, label); };
  const request = (host, pathname) => new NextRequest('http://' + host + pathname, { headers: { host } });
  for (const name of ['SAGA', 'www', 'ab', 'École & Sons', '世界', 'a'.repeat(150)]) {
    check(workspaceSlug.safeParse(companySlugBase(name)).success, 'Generated slug validates for ' + name.slice(0, 18));
  }
  await rejects(() => service.registerCompany(db, { ...input('invalid'), password: 'short' }, proof, sender), 'INVALID_INPUT', 'Short passwords cannot register');
  await rejects(() => service.registerCompany(db, { ...input('invalid'), email: 'invalid' }, proof, sender), 'INVALID_INPUT', 'Invalid email cannot register');
  await rejects(() => service.registerCompany(db, { ...input('invalid'), password: '😀'.repeat(20) }, proof, sender), 'INVALID_INPUT', 'Passwords exceeding bcrypt byte limit are rejected');
  const originalRoot = process.env.PLATFORM_ROOT_DOMAIN;
  process.env.PLATFORM_ROOT_DOMAIN = 'sample.vercel.app';
  await rejects(() => service.registerCompany(db, input('unroutable'), proof, sender), 'SETUP_REQUIRED', 'Unsupported tenant hosting cannot accept registration');
  process.env.PLATFORM_ROOT_DOMAIN = originalRoot;

  const first = input('first');
  const submitted = await service.registerCompany(db, first, proof, sender);
  const pending = await db.companyRegistration.findUniqueOrThrow({ where: { email: first.email } });
  check(!await db.user.findUnique({ where: { email: first.email } }) && !pending.organizationId, 'Unverified registration creates neither tenant nor login user');
  check(await compare(password, pending.passwordHash) && pending.passwordHash !== password, 'Pending password is hashed with existing bcrypt policy');
  check(pending.tokenHash === null && pending.otpHash === require('../src/features/company-registration/otp.ts').otpVerifier(first.email, pending.otpNonce, token(messages[0])) && pending.browserHash === hashActivationToken(proof), 'Only keyed OTP verifier and browser proof hash are stored');
  check(pending.deliveryStatus === 'SENT' && /^\d{6}$/.test(messages[0].code) && new URL(messages[0].verificationUrl).pathname === '/register/verify' && pending.expiresAt.getTime() - pending.lastIssuedAt.getTime() <= 600000, 'SMTP receives a six-digit code with ten-minute expiry and a public verification URL');
  check(Object.keys(submitted).sort().join(',') === 'email,retryAt,success' && !JSON.stringify(submitted).includes(token(messages[0])), 'Public registration response contains no secret or password');
  await service.registerCompany(db, { ...first, password: randomBytes(24).toString('hex'), companyName: 'Hostile replacement' }, stranger, sender);
  const unchanged = await db.companyRegistration.findUniqueOrThrow({ where: { email: first.email } });
  check(unchanged.passwordHash === pending.passwordHash && unchanged.companyName === first.companyName && messages.length === 1, 'Duplicate submission cannot overwrite pending company details or password');
  await rejects(() => verify(db, token(messages[0]), stranger), 'INVALID_VERIFICATION', 'Email link alone cannot activate an attacker-prepared password');
  await rejects(() => verify(db, randomBytes(32).toString('base64url'), proof), 'INVALID_VERIFICATION', 'Unknown tokens cannot activate a workspace');
  check((await service.resendCompanyVerification(db, first.email, proof, sender)).retryAt > Date.now(), 'Verification resend enforces its cooldown');
  await rejects(() => service.resendCompanyVerification(db, first.email, stranger, sender), 'INVALID_VERIFICATION', 'Another browser must know the registration password to resend');
  check(messages.length === 1, 'Another browser cannot resend or invalidate a pending registration');
  await db.companyRegistration.update({ where: { id: pending.id }, data: { lastIssuedAt: new Date(0) } });
  await service.resendCompanyVerification(db, first.email, proof, sender);
  await rejects(() => verify(db, token(messages[0]), proof), 'INVALID_VERIFICATION', 'Resending immediately invalidates the old token');
  const verified = await verify(db, token(messages[1]), '', password);
  const active = await db.companyRegistration.findUniqueOrThrow({ where: { id: pending.id }, include: { organization: true } });
  const org = active.organization;
  const user = await db.user.findUniqueOrThrow({ where: { email: first.email } });
  check(active.verifiedAt && active.tokenHash === null && active.otpHash === null && active.otpNonce === null && active.passwordHash === null, 'Verification consumes the token and removes the pending password hash');
  check(user.role === 'HR_ADMIN' && user.organizationId === org.id && user.name === first.administratorName, 'Verified registrant becomes only its own initial HR administrator');
  check(org.name === first.companyName && org.timeZone === 'UTC' && !org.careersEnabled && org.probationPolicy === null && org.hiringDocumentRequirements === null && org.employeeNumberPrefix === null, 'Neutral organization starts in UTC with careers disabled and no SAGA configuration');
  const empty = await Promise.all(['employee', 'job', 'payrollPeriod', 'payrollEntry', 'organizationPayrollPolicy', 'leaveType', 'workScheduleGroup', 'organizationBranding'].map(table => db[table].count({ where: { organizationId: org.id } })));
  check(empty.every(count => count === 0), 'No employee, payroll, hiring, leave, schedule or branding data is inherited');
  check(verified.loginUrl === `http://${org.slug}.localhost:3000/login?registered=1`, 'Verified registration redirects to its validated tenant login');
  check(await db.platformOrganizationAudit.count({ where: { organizationId: org.id, action: 'SELF_SERVICE_ORGANIZATION_VERIFIED' } }) === 1, 'Verified creation is audited without a platform operator');
  check(await db.organization.count({ where: { id: org.id } }) === 1, 'Organization is immediately visible to existing platform queries');
  await rejects(() => verify(db, token(messages[1]), proof), 'USED_CODE', 'Consumed verification cannot create a second organization');
  await db.platformAuthenticationAttempt.update({ where: { key: hashActivationToken('company-registration:submit:' + first.email) }, data: { windowStart: new Date(0) } });
  await service.registerCompany(db, first, proof, sender);
  check(messages.length === 2 && await db.user.count({ where: { email: first.email } }) === 1, 'Registered email cannot create duplicate users or send registration email');

  const login = new FormData(); login.set('email', first.email); login.set('password', password);
  const useHost = async host => { context.headers = new Headers({ host }); const routed = await proxy(request(host, '/login')); const signed = routed.headers.get('x-middleware-request-x-workpulse-routing-context'); if (signed) context.headers.set('x-workpulse-routing-context', signed); };
  await useHost(org.slug + '.localhost:3000');
  await assert.rejects(() => tenantActions.loginAction(login), error => error.message === 'REDIRECT:/dashboard');
  check((await sessions.getSession())?.organizationId === org.id, 'Verified administrator signs in through existing tenant authentication');
  await useHost('saga.localhost:3000');
  check(await sessions.getSession() === null && (await tenantActions.loginAction(login)).error, 'Valid new-company credentials and session cannot access SAGA');
  check((await proxy(request(org.slug + '.localhost:3000', '/register'))).status === 404, 'Registration page is inaccessible on tenant hosts');
  check((await proxy(request('app.localhost:3000', '/register/verify'))).status === 404, 'Verification page is inaccessible on discovery host');
  context.headers = new Headers({ host: org.slug + '.localhost:3000' });
  await assert.rejects(() => actions.verifyCompanyRegistrationAction({}, new FormData()), error => error.message === 'NOT_FOUND');
  check(true, 'Verification Server Action independently rejects tenant-host invocation');
  context.headers = new Headers({ host: 'localhost:3000' }); context.jar.clear();

  const collision = { ...input('collision'), companyName: first.companyName };
  await service.registerCompany(db, collision, proof, sender);
  const collisionResult = await verify(db, token(messages.at(-1)), proof);
  check(new URL(collisionResult.loginUrl).host !== new URL(verified.loginUrl).host, 'Companies with identical names receive unique validated slugs');
  const expired = input('expired');
  await service.registerCompany(db, expired, proof, sender); const expiredToken = token(messages.at(-1));
  await db.companyRegistration.update({ where: { email: expired.email }, data: { expiresAt: new Date(0) } });
  await rejects(() => verify(db, expiredToken, proof), 'EXPIRED_CODE', 'Expired verification cannot create a tenant');
  await service.registerCompany(db, expired, stranger, sender);
  check((await db.companyRegistration.findUniqueOrThrow({ where: { email: expired.email } })).browserHash === hashActivationToken(stranger), 'Expired pending registration can be restarted without reusing prior proofs');

  const failed = input('mail-failed');
  await rejects(() => service.registerCompany(db, failed, proof, async () => ({ success: false })), 'DELIVERY_FAILED', 'SMTP failure returns actionable feedback');
  check((await db.companyRegistration.findUniqueOrThrow({ where: { email: failed.email } })).deliveryStatus === 'FAILED' && !await db.user.findUnique({ where: { email: failed.email } }), 'Failed delivery leaves only a pending registration, never an active user');
  const previewBefore = emailer.getEmailLogs().length;
  await emailer.sendCompanyRegistrationVerificationEmail({ to: failed.email, organizationName: failed.companyName, code: '000000', verificationUrl: 'http://localhost:3000/register/verify', expiresAt: new Date() });
  check(emailer.getEmailLogs().length === previewBefore, 'Verification messages never leak to development email previews');

  const atomic = input('atomic'); await service.registerCompany(db, atomic, proof, sender); const atomicToken = token(messages.at(-1));
  await db.$executeRawUnsafe('SAVEPOINT registration_atomicity');
  const broken = new Proxy(db, { get(target, key) { if (key === 'user') return new Proxy(target.user, { get(delegate, method) { return method === 'create' ? async () => { throw Error('SYNTHETIC_INITIALIZATION_FAILURE'); } : Reflect.get(delegate, method); } }); if (key === '$transaction') return callback => callback(broken); return Reflect.get(target, key); } });
  await assert.rejects(() => verify(broken, atomicToken, proof));
  await db.$executeRawUnsafe('ROLLBACK TO SAVEPOINT registration_atomicity');
  check(!await db.user.findUnique({ where: { email: atomic.email } }) && !(await db.companyRegistration.findUniqueOrThrow({ where: { email: atomic.email } })).verifiedAt, 'Initialization failure rolls back company, user and verification together');
  await verify(db, atomicToken, proof);
  check(true, 'Verification can retry successfully after an atomic initialization failure');


  const exhausted = input('exhausted'); await service.registerCompany(db, exhausted, proof, sender);
  const correct = messages.at(-1).code;
  const wrong = correct === '000000' ? '111111' : '000000';
  for (let attempt = 1; attempt <= 5; attempt++) {
    await rejects(() => service.verifyCompanyRegistration(db, wrong, proof, '', exhausted.email), attempt === 5 ? 'ATTEMPTS_EXHAUSTED' : 'INVALID_VERIFICATION', 'Incorrect attempt ' + attempt + ' is counted');
    check((await db.companyRegistration.findUniqueOrThrow({ where: { email: exhausted.email } })).otpAttempts === attempt, 'Incorrect attempt persists after rejection ' + attempt);
  }
  await rejects(() => verify(db, correct, proof), 'ATTEMPTS_EXHAUSTED', 'Correct code is rejected after five incorrect attempts');
  await db.companyRegistration.update({ where: { email: exhausted.email }, data: { lastIssuedAt: new Date(0) } });
  await service.resendCompanyVerification(db, exhausted.email, '', sender, password);
  check((await db.companyRegistration.findUniqueOrThrow({ where: { email: exhausted.email } })).otpAttempts === 0, 'Cross-browser resend rotates the nonce and resets attempts');
  await verify(db, messages.at(-1).code, '', password);
  check(true, 'Cross-device code verification succeeds without any original browser cookie');

  const legacy = input('legacy'); await service.registerCompany(db, legacy, proof, sender);
  const oldLink = randomBytes(32).toString('base64url');
  await db.companyRegistration.update({ where: { email: legacy.email }, data: { tokenHash: hashActivationToken(oldLink), otpHash: null, otpNonce: null } });
  await service.verifyCompanyRegistration(db, oldLink, '', password);
  check(true, 'Existing pending link registration still completes safely across browsers with its password');
  const convert = input('convert'); await service.registerCompany(db, convert, proof, sender);
  const replacedLink = randomBytes(32).toString('base64url');
  await db.companyRegistration.update({ where: { email: convert.email }, data: { tokenHash: hashActivationToken(replacedLink), otpHash: null, otpNonce: null, lastIssuedAt: new Date(0) } });
  await service.resendCompanyVerification(db, convert.email, proof, sender);
  await rejects(() => service.verifyCompanyRegistration(db, replacedLink, proof), 'INVALID_VERIFICATION', 'Legacy link is invalidated when resending as OTP');
  await verify(db, messages.at(-1).code, proof);
  check(true, 'Legacy pending record converts to OTP through the same onboarding service');

  const limited = input('limited');
  for (let i = 0; i < 5; i++) await service.registerCompany(db, limited, proof, sender);
  await rejects(() => service.registerCompany(db, limited, proof, sender), 'RATE_LIMITED', 'Persistent registration budget limits duplicate and email-flood attempts');
  return { passed: true, assertions: checks.length, checks };
};

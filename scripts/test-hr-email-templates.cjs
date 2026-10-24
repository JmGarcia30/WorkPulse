/* eslint-disable @typescript-eslint/no-require-imports -- Recovery-only, rolled-back fixtures and mocked delivery. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
module.exports = async function test(db) {
  const { renderHrEmail, HR_EMAIL_TYPES, mockHrEmailDetails } = require('../src/features/email-integration/hr-templates.ts');
  const { deliverHrEmail } = require('../src/lib/email/hr.ts');
  const email = require('../src/lib/email/index.ts');
  const { encryptSecret } = require('../src/features/email-integration/crypto.ts');
  const { googleProvider, EmailIntegrationError } = require('../src/features/email-integration/google.ts');
  const { setSagaRecruitmentSender } = require('../src/features/email-integration/service.ts');
  const checks = [], messages = [];
  const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log('PASS:', label); };
  const brands = [{ name: 'SAGA', slug: 'st-aloysius', logoUrl: 'https://example.invalid/saga.png' }, { name: 'Northstar Services', slug: 'northstar', logoUrl: 'https://example.invalid/northstar.png' }, { name: 'Example Company', slug: 'example-company' }];
  for (const brand of brands) for (const type of HR_EMAIL_TYPES) {
    const name = brand.slug === 'st-aloysius' ? 'St. Aloysius Gonzaga Academy' : brand.name;
    const full = renderHrEmail(brand, type, mockHrEmailDetails());
    check(full.html.includes(name) && full.text.includes(name) && full.subject.includes(name) && full.text.includes('Human Resources Department') && full.text.includes('Jamie Rivera'), `${brand.slug}/${type}: own HR identity, subject, and recipient in HTML/text`);
    check(brand.logoUrl ? full.html.includes(brand.logoUrl) : !full.html.includes('<img'), `${brand.slug}/${type}: logo or clean text header`);
    check(full.html.includes('Sent securely through WorkPulse') && full.text.includes('Sent securely through WorkPulse') && (brand.slug === 'st-aloysius' || !full.text.includes('SAGA') && !full.html.includes('St. Aloysius')), `${brand.slug}/${type}: footer and isolated tenant content`);
    const minimal = renderHrEmail(brand, type, { scheduledAt: 'invalid', startDate: 'invalid', meetingUrl: 'javascript:alert(1)', portalUrl: 'https://user:password@example.invalid' });
    check(!/undefined|Invalid Date|javascript:|user:password/.test(minimal.html + minimal.text) && minimal.text.includes('Hello,'), `${brand.slug}/${type}: missing optional data and unsafe links handled`);
    const escaped = renderHrEmail(brand, type, { recipientName: '<script>alert(1)</script>', jobTitle: 'HR & Admin', instructions: ['<img src=x onerror=alert(1)>'] });
    check(!escaped.html.includes('<script>') && escaped.html.includes('&lt;script&gt;') && escaped.html.includes('HR &amp; Admin'), `${brand.slug}/${type}: dynamic content escaped`);
  }
  const interview = renderHrEmail(brands[1], 'interview', mockHrEmailDetails());
  check(interview.text.includes('Asia/Manila') && interview.text.includes('45 minutes') && interview.text.includes('Morgan Reyes') && interview.html.includes('mock-interview'), 'Interview includes timezone, duration, interviewer, and meeting link');
  const onboarding = renderHrEmail(brands[1], 'onboarding', mockHrEmailDetails());
  check(onboarding.text.includes('November 23, 2026') && onboarding.text.includes('documents') && !onboarding.text.includes('activate your account'), 'Onboarding includes start date and instructions without account activation');
  const prefix = 'hr-template-' + randomBytes(6).toString('hex');
  const tenants = [];
  for (const suffix of ['a', 'b']) {
    const org = await db.organization.create({ data: { name: `Mock HR Company ${suffix}`, slug: `${prefix}-${suffix}`, logoUrl: `https://example.invalid/${suffix}.png` } });
    await db.organizationEmailIntegration.create({ data: { organizationId: org.id, email: `${suffix}-sender@fixture.invalid`, googleSubject: `${prefix}-${suffix}`, status: 'CONNECTED', credentials: encryptSecret({ accessToken: `mock-${suffix}`, refreshToken: `mock-refresh-${suffix}`, expiresAt: Date.now() + 3600000 }, org.id + ':connection') } });
    tenants.push(org);
  }
  const saga = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
  const hr = await db.user.create({ data: { organizationId: saga.id, email: `${prefix}@fixture.invalid`, name: 'Mock HR', role: 'HR_ADMIN' } });
  const connection = { email: 'saga-sender@fixture.invalid', googleSubject: prefix + '-saga', status: 'CONNECTED', testedAt: null, recruitmentGmailActive: false, retryAt: null, credentials: encryptSecret({ accessToken: 'mock-saga', refreshToken: 'mock-saga-refresh', expiresAt: Date.now() + 3600000 }, saga.id + ':connection') };
  await db.organizationEmailIntegration.upsert({ where: { organizationId: saga.id }, create: { organizationId: saga.id, ...connection }, update: connection });
  const previousSend = googleProvider.send;
  let legacyCount = 0;
  const legacy = async message => { legacyCount++; check(message.to === 'recipient@fixture.invalid' && message.text.includes('St. Aloysius Gonzaga Academy'), 'Legacy SAGA preserves requested recipient and branding'); return { success: true, mode: 'smtp', id: 'mock' }; };
  try {
    googleProvider.send = async (token, raw) => { messages.push({ token, mime: Buffer.from(raw, 'base64url').toString('utf8') }); };
    const invalid = await deliverHrEmail(tenants[0].id, 'interview', 'bad-address', {}, legacy);
    check(!invalid.success && messages.length === 0 && legacyCount === 0, 'Invalid recipient rejected before either delivery path');
    const helpers = {
      acknowledgment: input => email.sendApplicationConfirmationEmail({ organizationId: input.organizationId, organizationSlug: 'forged-workspace', organizationName: 'Forged Company', to: input.to, candidateName: input.recipientName, jobTitle: input.jobTitle, applicationId: 'mock-application' }),
      interview: email.sendInterviewInvitationEmail, acceptance: email.sendSuccessfulApplicantEmail, rejection: email.sendApplicantRejectionEmail, onboarding: email.sendEmployeeOnboardingEmail,
    };
    for (const [index, org] of tenants.entries()) for (const type of HR_EMAIL_TYPES) {
      const result = await helpers[type]({ ...mockHrEmailDetails(), organizationId: org.id, to: 'recipient@fixture.invalid', from: 'spoof@fixture.invalid', organizationName: 'Wrong Company', logoUrl: 'https://example.invalid/wrong.png' });
      const sent = messages.at(-1), suffix = index === 0 ? 'a' : 'b';
      check(result.success && sent.token === `mock-${suffix}` && sent.mime.includes(`<${suffix}-sender@fixture.invalid>`) && sent.mime.includes('To: recipient@fixture.invalid'), `${suffix}/${type}: own encrypted credentials, connected sender, and exact recipient`);
      const body = [...sent.mime.matchAll(/Content-Type: text\/(?:plain|html)[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--)/g)].map(part => /Content-Transfer-Encoding: base64/.test(part[0]) ? Buffer.from(part[1].replace(/\s/g, ''), 'base64').toString('utf8') : part[1].replace(/=\r\n/g, '').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))).join('\n');
      check(sent.mime.includes('text/html') && sent.mime.includes('text/plain') && body.includes(org.name) && body.includes(`https://example.invalid/${suffix}.png`) && !body.includes('Wrong Company') && !body.includes('wrong.png') && !body.includes(tenants[1-index].name), `${suffix}/${type}: multipart content uses only selected tenant branding`);
      if (type === 'acknowledgment') check(body.includes(`/careers/${org.slug}/portal/mock-application`) && !body.includes('forged-workspace') && !body.includes('SAGA Institutional'), `${suffix}: acknowledgment portal uses stored workspace and excludes SAGA-only policies`);
    }
    await deliverHrEmail(saga.id, 'onboarding', 'recipient@fixture.invalid', mockHrEmailDetails(), legacy);
    check(legacyCount === 1 && messages.length === 10, 'SAGA remains on legacy sender before explicit activation');
    const nodemailer = require('nodemailer').default, previousTransport = nodemailer.createTransport;
    const environment = Object.fromEntries(['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_HOST', 'EMAIL_FROM'].map(key => [key, process.env[key]]));
    const smtp = [];
    try {
      Object.assign(process.env, { GMAIL_USER: '', GMAIL_APP_PASSWORD: '', SMTP_USER: 'mock-smtp@fixture.invalid', SMTP_PASSWORD: 'mock-only', SMTP_HOST: 'smtp.fixture.invalid', EMAIL_FROM: 'legacy-saga@fixture.invalid' });
      nodemailer.createTransport = () => ({ sendMail: async message => { smtp.push(message); } });
      for (const type of HR_EMAIL_TYPES) {
        const result = await helpers[type]({ ...mockHrEmailDetails(), organizationId: saga.id, to: 'recipient@fixture.invalid' });
        check(result.success && result.mode === 'smtp' && smtp.at(-1).from.includes('<legacy-saga@fixture.invalid>') && smtp.at(-1).to === 'recipient@fixture.invalid' && smtp.at(-1).text.includes('St. Aloysius Gonzaga Academy') && smtp.at(-1).html.includes('Sent securely through WorkPulse') && messages.length === 10, `SAGA/${type}: existing SMTP sender preserved with HTML and plain text`);
      }
      const platform = { to: 'platform-recipient@fixture.invalid', employeeName: 'Mock Employee', organizationName: 'Mock Organization', activationUrl: 'https://example.invalid/activation', expiresAt: new Date(Date.now() + 3600000) };
      await email.sendEmployeeActivationEmail(platform);
      await email.sendOrganizationAdministratorActivationEmail(platform);
      await email.sendCompanyRegistrationVerificationEmail(platform);
      check(smtp.slice(-3).every(message => !message.html.includes('Sent securely through WorkPulse')) && smtp.at(-3).subject.startsWith('Activate your WorkPulse account') && messages.length === 10, 'Employee/account invitations and registration verification retain platform transport and templates');
    } finally {
      nodemailer.createTransport = previousTransport;
      for (const [key, value] of Object.entries(environment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
    await assert.rejects(() => setSagaRecruitmentSender(db, { organizationId: saga.id, userId: hr.id }, true), error => error.code === 'SUCCESSFUL_TEST_REQUIRED');
    check(true, 'SAGA activation still requires a successful test');
    await db.organizationEmailIntegration.update({ where: { organizationId: saga.id }, data: { testedAt: new Date() } });
    await setSagaRecruitmentSender(db, { organizationId: saga.id, userId: hr.id }, true);
    for (const type of HR_EMAIL_TYPES) {
      const sent = await deliverHrEmail(saga.id, type, 'recipient@fixture.invalid', mockHrEmailDetails(), legacy);
      check(sent.success && messages.at(-1).token === 'mock-saga' && messages.at(-1).mime.includes('<saga-sender@fixture.invalid>') && legacyCount === 1, `SAGA/${type}: explicitly activated Gmail uses its own sender`);
    }
    googleProvider.send = async () => { throw new EmailIntegrationError('DELIVERY_UNCONFIRMED'); };
    check(!(await deliverHrEmail(saga.id, 'interview', 'recipient@fixture.invalid', {}, legacy)).success && legacyCount === 1, 'Gmail failure never falls back silently to legacy');
    await setSagaRecruitmentSender(db, { organizationId: saga.id, userId: hr.id }, false);
    check((await deliverHrEmail(saga.id, 'rejection', 'recipient@fixture.invalid', {}, legacy)).success && legacyCount === 2, 'Explicit revert restores SAGA legacy sender');
  } finally { googleProvider.send = previousSend; }
  return { passed: true, assertions: checks.length, checks, externalDeliveries: 0 };
};

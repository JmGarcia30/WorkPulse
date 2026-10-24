/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic recovery fixtures in an outer rollback transaction. All Gmail/SMTP calls mocked. */
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
module.exports = async function test(db, context) {
  const workflow = require('../src/features/hiring/hr-email-workflows.ts');
  const actions = require('../src/features/hiring/hr-email-actions.ts');
  const integration = require('../src/features/email-integration/service.ts');
  const { googleProvider, EmailIntegrationError } = require('../src/features/email-integration/google.ts');
  const { encryptSecret } = require('../src/features/email-integration/crypto.ts');
  const { sendRenderedHrEmail } = require('../src/lib/email/hr.ts');
  const mail = require('../src/lib/email/index.ts');
  const nodemailer = require('nodemailer').default;
  const checks = [], gmail = [], smtp = [], fixtures = [];
  const prefix = 'hr-workflow-' + randomBytes(5).toString('hex');
  const check = (condition, label) => { assert.ok(condition, label); checks.push(label); console.log('PASS:', label); };
  const denied = async (work, label) => { await assert.rejects(work, error => error instanceof workflow.HrWorkflowError); check(true, label); };
  const confirm = preview => ({ id: preview.id, contentHash: preview.contentHash, confirmed: true });
  const { proxy } = require('../src/proxy.ts'), { NextRequest } = require('next/server'), { createSession } = require('../src/lib/auth/session.ts');
  async function session(user, org) {
    context.jar.clear(); context.headers = new Headers({ host: org.slug + '.localhost:3000' });
    const routed = await proxy(new NextRequest('http://' + org.slug + '.localhost:3000/dashboard', { headers: context.headers }));
    for (const [key, value] of routed.headers) if (key.startsWith('x-middleware-request-')) context.headers.set(key.slice(21), value);
    await createSession({ userId: user.id, organizationId: org.id, email: user.email, role: user.role, name: user.name });
  }
  const organizations = [
    await db.organization.create({ data: { name: 'Mock Northstar HR', slug: prefix + '-a', logoUrl: 'https://example.invalid/northstar.png', timeZone: 'Asia/Manila' } }),
    await db.organization.create({ data: { name: 'Mock No Logo HR', slug: prefix + '-b', timeZone: 'Asia/Manila' } }),
    await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } }),
  ];
  const tenants = [];
  for (const [index, org] of organizations.entries()) {
    const user = await db.user.create({ data: { organizationId: org.id, name: 'Mock HR', email: `${prefix}-hr-${index}@fixture.invalid`, role: 'HR_ADMIN' } });
    const hiring = await db.user.create({ data: { organizationId: org.id, name: 'Mock Hiring', email: `${prefix}-hiring-${index}@fixture.invalid`, role: 'HIRING_MANAGER' } });
    const job = await db.job.create({ data: { organizationId: org.id, title: 'Administrative Assistant', slug: prefix + '-job-' + index, department: 'Test', employmentType: 'Full-time', location: 'Mock Office', description: 'Mock', responsibilities: 'Mock', qualifications: 'Mock', requirements: 'Mock', status: 'DRAFT' } });
    const connection = { email: `${prefix}-sender-${index}@fixture.invalid`, googleSubject: `${prefix}-google-${index}`, status: 'CONNECTED', recruitmentGmailActive: false, testedAt: null, retryAt: null, lastError: null, credentials: encryptSecret({ accessToken: 'mock-access-' + index, refreshToken: 'mock-refresh-' + index, expiresAt: Date.now() + 3600000 }, org.id + ':connection') };
    await db.organizationEmailIntegration.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, ...connection }, update: connection });
    tenants.push({ org, user, hiring, job, actor: { organizationId: org.id, userId: user.id }, connection, index });
  }
  let sequence = 0;
  async function fixture(tenant, type, suffix = '') {
    const applicant = await db.applicant.create({ data: { firstName: 'Jamie', lastName: `Mock-${++sequence}`, email: `${prefix}-recipient-${sequence}@fixture.invalid`, phone: '0' } });
    const application = await db.application.create({ data: { jobId: tenant.job.id, applicantId: applicant.id, coverLetter: 'Synthetic HR email fixture', status: type === 'rejection' ? 'REJECTED' : type === 'acceptance' ? 'OFFER' : type === 'onboarding' ? 'HIRED' : type === 'interview' ? 'INTERVIEW' : 'APPLIED' } });
    let interview;
    if (type === 'interview') interview = await db.interview.create({ data: { applicationId: application.id, interviewerId: tenant.hiring.id, scheduledAt: new Date(Date.now() + 86400000 * 7), durationMinutes: 45, location: 'Mock meeting room', meetingUrl: 'https://example.invalid/mock-interview', notes: 'PRIVATE INTERVIEW NOTES' } });
    if (['acceptance', 'onboarding'].includes(type)) await db.offer.create({ data: { applicationId: application.id, salary: 1, employmentType: 'Full-time', startDate: new Date(Date.now() + 86400000 * 30), createdById: tenant.user.id, approvedById: tenant.user.id, status: type === 'acceptance' ? 'APPROVED' : 'ACCEPTED', notes: 'PRIVATE OFFER NOTES' } });
    let employee;
    if (type === 'onboarding') {
      await db.onboardingProcess.create({ data: { applicationId: application.id, status: 'IN_PROGRESS', startDate: new Date(Date.now() + 86400000 * 30), notes: 'PRIVATE ONBOARDING NOTES', tasks: { create: [{ title: 'Bring verified identification', description: 'PRIVATE TASK DESCRIPTION', reviewerNotes: 'PRIVATE REVIEW NOTES', dueDate: new Date(Date.now() + 86400000 * 20) }] } } });
      employee = await db.employee.create({ data: { organizationId: tenant.org.id, applicantId: applicant.id, sourceApplicationId: application.id, employeeNumber: `${prefix}-${sequence}`, firstName: 'Jamie', lastName: 'Mock Employee', email: `${prefix}-employee-${sequence}@fixture.invalid`, phone: '0', createdById: tenant.user.id } });
    }
    const input = { applicationId: application.id, type, ...(interview ? { interviewId: interview.id } : {}), ...(type === 'onboarding' ? { instructions: 'Contact HR before your first day. ' + suffix } : {}) };
    const result = { ...tenant, applicant, application, employee, interview, input };
    fixtures.push(result); return result;
  }
  const originalSend = googleProvider.send, originalTransport = nodemailer.createTransport;
  const oldEnvironment = Object.fromEntries(['GMAIL_USER','GMAIL_APP_PASSWORD','SMTP_USER','SMTP_PASSWORD','SMTP_HOST','EMAIL_FROM'].map(key => [key, process.env[key]]));
  let nextError, smtpFailure = false;
  try {
    Object.assign(process.env, { GMAIL_USER: '', GMAIL_APP_PASSWORD: '', SMTP_USER: 'mock@fixture.invalid', SMTP_PASSWORD: 'mock-only', SMTP_HOST: 'smtp.fixture.invalid', EMAIL_FROM: 'legacy-saga@fixture.invalid' });
    googleProvider.send = async (token, raw) => { if (nextError) { const error = nextError; nextError = undefined; throw error; } gmail.push({ token, mime: Buffer.from(raw, 'base64url').toString('utf8') }); };
    nodemailer.createTransport = () => ({ sendMail: async message => { if (smtpFailure) throw Error('MOCK_SMTP_FAILURE'); smtp.push(message); } });
    for (const tenant of tenants) for (const type of ['acknowledgment','interview','acceptance','rejection','onboarding']) {
      const f = await fixture(tenant, type);
      const before = gmail.length + smtp.length;
      const preview = await workflow.prepareHrWorkflow(tenant.actor, f.input, db);
      check(gmail.length + smtp.length === before && preview.to === (f.employee?.email || f.applicant.email), `${tenant.index}/${type}: preview sends nothing and uses saved applicant/employee recipient`);
      check(preview.html.includes(tenant.index === 2 ? 'St. Aloysius Gonzaga Academy' : tenant.org.name) && preview.text.includes('Human Resources Department') && !/PRIVATE (INTERVIEW|OFFER|ONBOARDING|TASK|REVIEW)/.test(preview.html + preview.text), `${tenant.index}/${type}: own branding and public details, no internal notes`);
      if (tenant.index === 0) check(preview.html.includes('northstar.png'), `${type}: organization logo retained`);
      if (tenant.index === 1) check(!preview.html.includes('<img'), `${type}: no-logo text fallback retained`);
      if (type === 'interview') check(preview.text.includes('Asia/Manila') && preview.text.includes('Mock meeting room') && preview.html.includes('mock-interview'), `${tenant.index}: saved interview date, timezone, location, and link included`);
      if (type === 'onboarding') check(preview.text.includes('Bring verified identification') && preview.text.includes('Contact HR before your first day.'), `${tenant.index}: saved onboarding tasks and reviewed instructions included`);
      await denied(() => workflow.sendHrWorkflow(tenant.actor, f.input, { ...confirm(preview), confirmed: false }, db), `${tenant.index}/${type}: explicit confirmation required`);
      const result = await workflow.sendHrWorkflow(tenant.actor, f.input, confirm(preview), db);
      const history = await workflow.hrWorkflowHistory(tenant.actor, f.application.id, db);
      check(result.success && history[0].status === 'SUBMITTED' && history[0].attemptCount === 1 && history[0].recipient === preview.to && history[0].submittedAt, `${tenant.index}/${type}: confirmed send records one submitted attempt`);
      check(tenant.index === 2 ? smtp.at(-1).from.includes('<legacy-saga@fixture.invalid>') && smtp.at(-1).to === preview.to : gmail.at(-1).token === 'mock-access-' + tenant.index && gmail.at(-1).mime.includes(`<${tenant.connection.email}>`) && gmail.at(-1).mime.includes(preview.to), `${tenant.index}/${type}: tenant Gmail sender or preserved SAGA SMTP selected`);
      await denied(() => workflow.sendHrWorkflow(tenant.actor, f.input, confirm(preview), db), `${tenant.index}/${type}: repeated confirmation cannot send twice`);
      await denied(() => workflow.prepareHrWorkflow(tenant.actor, f.input, db), `${tenant.index}/${type}: repeated preview cannot reset submitted status`);
      check(gmail.length + smtp.length === before + 1, `${tenant.index}/${type}: only one provider submission`);
    }
    const a = tenants[0], b = tenants[1], saga = tenants[2];
    const target = await fixture(a, 'acknowledgment');
    await denied(() => workflow.prepareHrWorkflow(b.actor, target.input, db), 'Other tenant cannot preview or address an application');
    await denied(() => workflow.hrWorkflowHistory(b.actor, target.application.id, db), 'Other tenant cannot read delivery history');
    await denied(() => workflow.prepareHrWorkflow({ organizationId: a.org.id, userId: b.user.id }, target.input, db), 'Forged actor organization is rejected by persisted membership');
    await denied(() => workflow.prepareHrWorkflow({ organizationId: a.org.id, userId: a.hiring.id }, target.input, db), 'Hiring Manager cannot send HR decision or onboarding emails');
    await denied(() => workflow.prepareHrWorkflow(a.actor, { ...target.input, to: 'forged@fixture.invalid', organizationId: b.org.id }, db), 'Forged recipients and organization fields are rejected');
    let preview = await workflow.prepareHrWorkflow(a.actor, target.input, db);
    await denied(() => workflow.sendHrWorkflow(b.actor, target.input, confirm(preview), db), 'Copied confirmation cannot cross tenants');
    await db.applicant.update({ where: { id: target.applicant.id }, data: { email: 'invalid-address' } });
    await denied(() => workflow.prepareHrWorkflow(a.actor, target.input, db), 'Invalid saved recipient cannot be previewed or sent');
    await db.applicant.update({ where: { id: target.applicant.id }, data: { email: prefix + '-changed@fixture.invalid' } });
    await denied(() => workflow.sendHrWorkflow(a.actor, target.input, confirm(preview), db), 'Changed saved recipient invalidates old confirmation');
    preview = await workflow.prepareHrWorkflow(a.actor, target.input, db);
    await db.organizationEmailIntegration.update({ where: { organizationId: a.org.id }, data: { email: prefix + '-changed-sender@fixture.invalid' } });
    await denied(() => workflow.sendHrWorkflow(a.actor, target.input, confirm(preview), db), 'Changed sender invalidates old confirmation');
    await db.organizationEmailIntegration.update({ where: { organizationId: a.org.id }, data: { email: a.connection.email } });
    preview = await workflow.prepareHrWorkflow(a.actor, target.input, db);
    const racingBefore = gmail.length;
    const racing = await Promise.allSettled([workflow.sendHrWorkflow(a.actor, target.input, confirm(preview), db), workflow.sendHrWorkflow(a.actor, target.input, confirm(preview), db)]);
    check(racing.filter(item => item.status === 'fulfilled' && item.value.success).length === 1 && gmail.length === racingBefore + 1, 'Atomic delivery claim permits exactly one concurrent confirmation');
    const stale = await fixture(a, 'acknowledgment');
    preview = await workflow.prepareHrWorkflow(a.actor, stale.input, db);
    await db.application.update({ where: { id: stale.application.id }, data: { status: 'REJECTED' } });
    const beforeStatus = gmail.length + smtp.length;
    await denied(() => workflow.sendHrWorkflow(a.actor, stale.input, confirm(preview), db), 'Workflow change after preview blocks obsolete acknowledgment');
    check(gmail.length + smtp.length === beforeStatus, 'Changing applicant status alone triggers no email');
    const notReady = await fixture(a, 'acknowledgment');
    for (const type of ['interview','acceptance','rejection','onboarding']) await denied(() => workflow.prepareHrWorkflow(a.actor, { applicationId: notReady.application.id, type }, db), `${type}: prerequisite workflow records/status required`);
    const cancelled = await fixture(a, 'interview');
    await db.interview.update({ where: { id: cancelled.interview.id }, data: { status: 'CANCELLED' } });
    await denied(() => workflow.prepareHrWorkflow(a.actor, cancelled.input, db), 'Cancelled interview cannot generate an invitation');
    const limited = await fixture(a, 'acknowledgment');
    preview = await workflow.prepareHrWorkflow(a.actor, limited.input, db); nextError = new EmailIntegrationError('SENDING_LIMIT');
    check(!(await workflow.sendHrWorkflow(a.actor, limited.input, confirm(preview), db)).success && (await workflow.hrWorkflowHistory(a.actor, limited.application.id, db))[0].status === 'FAILED', 'Definite provider failure records FAILED without changing applicant status');
    await db.organizationEmailIntegration.update({ where: { organizationId: a.org.id }, data: { status: 'CONNECTED', retryAt: null, lastError: null } });
    preview = await workflow.prepareHrWorkflow(a.actor, limited.input, db);
    check((await workflow.sendHrWorkflow(a.actor, limited.input, confirm(preview), db)).success && (await workflow.hrWorkflowHistory(a.actor, limited.application.id, db))[0].attemptCount === 2, 'Failed attempt may retry only after fresh preview and explicit confirmation');
    const uncertain = await fixture(a, 'acknowledgment');
    preview = await workflow.prepareHrWorkflow(a.actor, uncertain.input, db); nextError = new EmailIntegrationError('DELIVERY_UNCONFIRMED');
    check(!(await workflow.sendHrWorkflow(a.actor, uncertain.input, confirm(preview), db)).success && (await workflow.hrWorkflowHistory(a.actor, uncertain.application.id, db))[0].status === 'UNKNOWN', 'Ambiguous Gmail failure records UNKNOWN');
    await denied(() => workflow.prepareHrWorkflow(a.actor, uncertain.input, db), 'Unknown delivery cannot be resent accidentally');
    await db.organizationEmailIntegration.update({ where: { organizationId: a.org.id }, data: { status: 'CONNECTED', lastError: null } });
    const changed = await fixture(a, 'acknowledgment');
    preview = await workflow.prepareHrWorkflow(a.actor, changed.input, db);
    const beforeSwitch = gmail.length;
    const switched = await workflow.sendHrWorkflow(a.actor, changed.input, confirm(preview), db, async (org, message) => {
      await db.organizationEmailIntegration.update({ where: { organizationId: org }, data: { email: 'switched@fixture.invalid' } });
      return sendRenderedHrEmail(org, message, async () => { throw Error('UNEXPECTED_LEGACY'); });
    });
    check(!switched.success && gmail.length === beforeSwitch && (await workflow.hrWorkflowHistory(a.actor, changed.application.id, db))[0].errorCode === 'STALE_PREVIEW', 'Sender switch immediately before dispatch cannot use an unpreviewed account');
    await assert.rejects(() => integration.setSagaRecruitmentSender(db, saga.actor, true), error => error.code === 'SUCCESSFUL_TEST_REQUIRED'); check(true, 'SAGA successful-test activation requirement remains enforced');
    await integration.testConnection(db, saga.actor, `${prefix}-test@fixture.invalid`);
    await integration.setSagaRecruitmentSender(db, saga.actor, true);
    const sagaGmail = await fixture(saga, 'acknowledgment');
    preview = await workflow.prepareHrWorkflow(saga.actor, sagaGmail.input, db);
    const beforeSagaSmtp = smtp.length;
    check((await workflow.sendHrWorkflow(saga.actor, sagaGmail.input, confirm(preview), db)).success && gmail.at(-1).token === 'mock-access-2' && smtp.length === beforeSagaSmtp, 'Explicitly activated SAGA Gmail is reused for confirmed workflow sending');
    await integration.setSagaRecruitmentSender(db, saga.actor, false);
    const sagaSmtpFailure = await fixture(saga, 'acknowledgment');
    preview = await workflow.prepareHrWorkflow(saga.actor, sagaSmtpFailure.input, db); smtpFailure = true;
    check(!(await workflow.sendHrWorkflow(saga.actor, sagaSmtpFailure.input, confirm(preview), db)).success && (await workflow.hrWorkflowHistory(saga.actor, sagaSmtpFailure.application.id, db))[0].status === 'UNKNOWN', 'Ambiguous SMTP failure is not reported as delivered or automatically retried');
    smtpFailure = false;
    await session(a.user, a.org);
    const actionPreview = await actions.previewHrEmailAction(notReady.input);
    check(actionPreview.preview?.to === notReady.applicant.email, 'Preview Server Action derives tenant and HR actor from session');
    check(!(await actions.sendHrEmailAction(notReady.input, { ...confirm(actionPreview.preview), confirmed: false })).success, 'Send Server Action independently enforces explicit confirmation');
    await session(a.hiring, a.org);
    check(!!(await actions.previewHrEmailAction(notReady.input)).error, 'Server Action rejects unauthorized persisted role');
    const beforePlatform = gmail.length;
    await mail.sendCompanyRegistrationVerificationEmail({ to: `${prefix}-platform@fixture.invalid`, organizationName: a.org.name, activationUrl: 'https://example.invalid/verify', expiresAt: new Date() });
    check(gmail.length === beforePlatform && !smtp.at(-1).html.includes('Sent securely through WorkPulse'), 'Platform verification stays separate from company HR email');
    const stable = fixtures.filter(f => ![stale.application.id].includes(f.application.id));
    for (const f of stable) {
      const current = await db.application.findUniqueOrThrow({ where: { id: f.application.id }, include: { employee: true } });
      assert.equal(current.status, f.application.status);
      if (f.employee) assert.deepEqual(current.employee, f.employee);
    }
    check(true, 'Email workflows preserve fixture applicant statuses and every employee record');
    check(await db.applicationStatusHistory.count({ where: { applicationId: { in: fixtures.map(f => f.application.id) } } }) === 0, 'Email sending creates no applicant status-transition history');
    const history = await workflow.hrWorkflowHistory(a.actor, limited.application.id, db);
    check(!JSON.stringify(history).includes('mock-access') && !JSON.stringify(history).includes('<html>') && history.every(row => !('credentials' in row)), 'Delivery history contains status metadata only, without credentials or message bodies');
  } finally {
    googleProvider.send = originalSend; nodemailer.createTransport = originalTransport;
    for (const [key, value] of Object.entries(oldEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  return { passed: true, assertions: checks.length, checks, realDeliveries: 0, realApplicantOrEmployeeRecordsModified: false };
};

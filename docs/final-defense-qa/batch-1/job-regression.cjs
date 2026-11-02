const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const path = require('node:path');

module.exports = async function jobRegression(db, context) {
  const { hash } = require('bcryptjs');
  const { NextRequest } = require('next/server');
  const { proxy } = require(path.resolve('src/proxy.ts'));
  const auth = require(path.resolve('src/lib/auth/session.ts'));
  const actions = require(path.resolve('src/features/hiring/actions.ts'));
  const marker = 'b1-jobs-' + randomBytes(5).toString('hex');
  const passwordHash = await hash(randomBytes(20).toString('hex'), 4);
  const org = await db.organization.create({ data: { name: 'Synthetic Batch 1', slug: marker } });
  const foreign = await db.organization.create({ data: { name: 'Synthetic foreign', slug: marker + '-foreign' } });
  const user = await db.user.create({ data: { organizationId: org.id, name: 'Synthetic HR', email: marker + '@fixture.invalid', role: 'HR_ADMIN', passwordHash } });
  const payload = role => ({ userId: user.id, name: user.name, email: user.email, organizationId: org.id, role });
  async function tenantHeaders(slug) {
    context.headers = new Headers({ host: slug + '.localhost:3000' });
    const routed = await proxy(new NextRequest('http://' + slug + '.localhost:3000/login', { headers: context.headers }));
    context.headers.set('x-workpulse-routing-context', routed.headers.get('x-middleware-request-x-workpulse-routing-context'));
  }
  await tenantHeaders(org.slug);
  await auth.createSession(payload('HR_ADMIN'), passwordHash);
  const checks = [];
  const ok = (value, message) => { assert(value, message); checks.push(message); console.log('PASS ' + message); };
  const requirements = name => JSON.stringify([{ name, type: 'SKILL', description: 'Synthetic requirement', isRequired: true }]);
  const form = (overrides = {}) => {
    const result = new FormData();
    for (const [key, value] of Object.entries({ title: 'Batch 1 original', department: 'QA', employmentType: 'Full-time', location: 'Synthetic', description: 'Synthetic description', responsibilities: 'Synthetic', qualifications: 'Synthetic', category: 'NON_TEACHING', closingDate: '2026-12-01', requirementsJson: requirements('Original requirement'), ...overrides })) result.set(key, value);
    return result;
  };
  const redirected = async fn => {
    try { await fn(); } catch (error) { if (error.message.startsWith('REDIRECT:')) return error.message; throw error; }
    throw Error('Expected action redirect');
  };
  await redirected(() => actions.createJobAction(form()));
  const job = await db.job.findFirstOrThrow({ where: { organizationId: org.id } });
  const snapshot = async id => JSON.stringify(await db.job.findUniqueOrThrow({ where: { id }, include: { structuredReqs: { orderBy: { id: 'asc' } } } }));
  const baseline = await snapshot(job.id);
  const invalid = [
    ['invalid date', { closingDate: 'not-a-valid-date' }],
    ['impossible calendar date', { closingDate: '2026-02-30' }],
    ['malformed requirements JSON', { requirementsJson: '{broken' }],
    ['non-array requirements', { requirementsJson: '{}' }],
    ['null requirement', { requirementsJson: '[null]' }],
    ['invalid requirement enum', { requirementsJson: JSON.stringify([{ name: 'Invalid', type: 'INVALID' }]) }],
    ['invalid required flag', { requirementsJson: JSON.stringify([{ name: 'Invalid', type: 'SKILL', isRequired: 'false' }]) }],
    ['missing required job field', { title: '' }],
  ];
  for (const [label, overrides] of invalid) {
    const destination = await redirected(() => actions.updateJobAction(job.id, form(overrides)));
    ok(destination.includes('/edit?error=') && await snapshot(job.id) === baseline, 'B1-JOB invalid edit preserves complete job and requirement IDs: ' + label);
  }

  // Force a real database insertion failure after nested requirement replacement begins.
  const schema = new URL(process.env.DATABASE_URL).searchParams.get('schema');
  assert.match(schema, /^batch3_test_[a-f0-9]{24}$/);
  await db.$executeRawUnsafe(`CREATE FUNCTION "${schema}"."b1_reject_requirement"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.name = 'B1 forced failure' THEN RAISE EXCEPTION 'B1_FORCED_REQUIREMENT_FAILURE'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "b1_requirement_failure" BEFORE INSERT ON "${schema}"."JobRequirement" FOR EACH ROW EXECUTE FUNCTION "${schema}"."b1_reject_requirement"()`);
  await assert.rejects(() => actions.updateJobAction(job.id, form({ title: 'Must roll back', requirementsJson: requirements('B1 forced failure') })), error => error.message.includes('B1_FORCED_REQUIREMENT_FAILURE'));
  ok(await snapshot(job.id) === baseline, 'B1-JOB database failure rolls back job fields and requirement deletion together');

  const foreignJob = await db.job.create({ data: { organizationId: foreign.id, title: 'Foreign', slug: 'foreign', department: 'QA', employmentType: 'Full-time', location: 'QA', description: 'QA', qualifications: 'QA', responsibilities: 'QA', requirements: 'QA', structuredReqs: { create: { name: 'Foreign requirement', type: 'SKILL', isRequired: true } } } });
  const foreignBefore = await snapshot(foreignJob.id);
  ok((await redirected(() => actions.updateJobAction(foreignJob.id, form()))).endsWith('error=not_found') && await snapshot(foreignJob.id) === foreignBefore, 'B1-JOB cross-tenant edits cannot change foreign requirements');
  await db.user.update({ where: { id: user.id }, data: { role: 'HIRING_MANAGER' } });
  await auth.createSession(payload('HIRING_MANAGER'), passwordHash);
  ok((await redirected(() => actions.updateJobAction(job.id, form()))).endsWith('error=unauthorized') && await snapshot(job.id) === baseline, 'B1-JOB hiring manager cannot edit jobs');
  await db.user.update({ where: { id: user.id }, data: { role: 'HR_ADMIN' } });
  await auth.createSession(payload('HR_ADMIN'), passwordHash);
  await tenantHeaders(foreign.slug);
  ok((await redirected(() => actions.updateJobAction(job.id, form()))).endsWith('error=unauthorized') && await snapshot(job.id) === baseline, 'B1-JOB copied tenant session cannot edit across workspace hosts');
  await tenantHeaders(org.slug);

  await redirected(() => actions.updateJobAction(job.id, form({ title: 'Valid edit', requirementsJson: requirements('Replacement requirement') })));
  let current = await db.job.findUniqueOrThrow({ where: { id: job.id }, include: { structuredReqs: true } });
  ok(current.title === 'Valid edit' && current.structuredReqs.length === 1 && current.structuredReqs[0].name === 'Replacement requirement' && current.status === 'DRAFT', 'B1-JOB valid edit replaces requirements without changing publication state');
  await redirected(() => actions.updateJobAction(job.id, form({ requirementsJson: '[]' })));
  ok(await db.jobRequirement.count({ where: { jobId: job.id } }) === 0, 'B1-JOB explicit empty array still clears requirements');
  await Promise.all(['Concurrent A', 'Concurrent B'].map(title => redirected(() => actions.updateJobAction(job.id, form({ title, requirementsJson: requirements(title) })))));
  current = await db.job.findUniqueOrThrow({ where: { id: job.id }, include: { structuredReqs: true } });
  ok(['Concurrent A', 'Concurrent B'].includes(current.title) && current.structuredReqs.length === 1 && current.structuredReqs[0].name === current.title && current.requirements === current.title, 'B1-JOB concurrent valid edits leave one complete matching requirement set');
  await actions.publishJobAction(job.id);
  ok((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status === 'PUBLISHED', 'B1-JOB publication unchanged');
  await actions.closeJobAction(job.id);
  ok((await db.job.findUniqueOrThrow({ where: { id: job.id } })).status === 'CLOSED', 'B1-JOB closure unchanged');
  return { passed: true, assertions: checks.length, checks, databaseFailureInjectedInOwnedSchemaOnly: true };
};

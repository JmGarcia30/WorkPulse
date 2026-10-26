/* eslint-disable @typescript-eslint/no-require-imports -- Explicitly guarded, synthetic-only PostgreSQL verification fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { PrismaClient, Prisma } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const directory = 'docs/hiring-final-verification-2026-10-27';
const save = (name, data) => { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(`${directory}/${name}.json`, JSON.stringify({ capturedAt: new Date().toISOString(), ...data }, null, 2) + '\n'); };

async function context() {
  const config = helper.configuration();
  assert.equal(config.identity.branchId, 'br-damp-fog-azmmxhga');
  assert.equal(config.identity.endpointId, 'ep-wild-mud-az8yzifu');
  assert(config.identity.distinctFromProtectedOriginal);
  const preflight = JSON.parse(fs.readFileSync(`${directory}/database-preflight.json`));
  assert.equal(preflight.schema, 'PASS'); assert.equal(preflight.appliedMigrations, 38);
  assert.equal(preflight.identity.branch_id, config.identity.branchId);
  const read = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  const [identity] = await read.$queryRaw`SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('default_transaction_read_only') AS read_only`;
  assert.equal(identity.branch_id, config.identity.branchId); assert.equal(identity.endpoint_id, config.identity.endpointId);
  assert.equal(identity.database, 'neondb'); assert.equal(identity.read_only, 'on');
  await read.$disconnect();
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  const marker = 'hiring-verify-' + randomBytes(8).toString('hex');
  const owned = { organizations: [], users: [], jobs: [], applicants: [], applications: [] };
  let sequence = 0;
  async function tenant(client, saga = false, passwordHash) {
    let org;
    if (saga) org = await client.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' } });
    else {
      const def = category => ({ type: 'OTHER', title: `Synthetic ${category} eligibility`, isRequired: true, isConditional: false, submissionTarget: 'Synthetic HR' });
      org = await client.organization.create({ data: {
        name: 'Synthetic hiring verification', slug: marker + '-' + (++sequence),
        hiringDocumentRequirements: { TEACHING: [def('teaching')], NON_TEACHING: [def('staff')] },
      } });
      owned.organizations.push(org.id);
    }
    const actors = {};
    for (const role of ['HR_ADMIN', 'ORGANIZATION_ADMIN', 'HIRING_MANAGER', 'EMPLOYEE']) {
      const user = await client.user.create({ data: { organizationId: org.id, name: 'Synthetic ' + role, role, email: `${marker}-${++sequence}@fixture.invalid`, passwordHash: passwordHash || null } });
      owned.users.push(user.id); actors[role] = user;
    }
    return { org, actors };
  }
  async function candidate(client, owner, options = {}) {
    const category = options.category || 'NON_TEACHING';
    const actor = owner.actors.HR_ADMIN;
    const { resolveHiringDocumentPolicy } = require('../src/features/hiring/document-policy.ts');
    const { getOnboardingTaskTemplates } = require('../src/features/hiring/onboarding-pipeline.ts');
    const policy = resolveHiringDocumentPolicy(owner.org, category);
    const job = await client.job.create({ data: {
      organizationId: owner.org.id, title: 'Synthetic Hiring Position', slug: marker + '-' + (++sequence), category,
      department: 'Synthetic verification', employmentType: 'Full-time', location: 'Synthetic campus',
      description: 'Synthetic verification only', responsibilities: 'Synthetic verification only', qualifications: 'Synthetic verification only', requirements: 'Synthetic verification only', status: 'PUBLISHED',
    } }); owned.jobs.push(job.id);
    const applicant = await client.applicant.create({ data: { firstName: 'Synthetic', lastName: 'Candidate ' + (++sequence), email: marker + '-' + sequence + '@fixture.invalid', phone: '09000000000' } }); owned.applicants.push(applicant.id);
    const application = await client.application.create({ data: { applicantId: applicant.id, jobId: job.id, status: options.status || 'OFFER', coverLetter: 'Synthetic regression fixture' } }); owned.applications.push(application.id);
    await client.recruitmentDocument.createMany({ data: policy.requirements.map(def => ({ applicationId: application.id, type: def.type, title: def.title, isRequired: def.isRequired, isConditional: def.isConditional, status: 'VERIFIED', verifiedAt: new Date('2026-10-01'), verifiedById: actor.id, requestedAt: new Date('2026-10-01') })) });
    await client.assessment.create({ data: { applicationId: application.id, title: 'Written Examination', type: 'WRITTEN_EXAMINATION', status: 'PASSED', score: 90, maxScore: 100, passingScore: 75, evaluatorId: actor.id, evaluatedAt: new Date('2026-10-02') } });
    const types = ['INITIAL_SCREENING', ...(policy.isSaga ? [...(category === 'TEACHING' ? ['TEACHING_DEMONSTRATION'] : []), 'HEAD_OF_DEPARTMENT', 'PRESIDENT_FINAL'] : [])];
    for (const type of types) await client.interview.create({ data: {
      applicationId: application.id, interviewerId: actor.id, type, status: 'COMPLETED', scheduledAt: new Date('2026-10-03'),
      evaluation: { create: { communicationScore: 5, technicalScore: 5, problemSolvingScore: 5, experienceScore: 5, cultureFitScore: 5, overallScore: 5, recommendation: 'RECOMMEND', comments: 'Synthetic positive evaluation', evaluatedById: actor.id } },
    } });
    await client.offer.create({ data: {
      applicationId: application.id, status: 'ACCEPTED', salary: 35000, payFrequency: 'MONTHLY', employmentType: 'Full-time', startDate: new Date('2026-11-01'),
      createdById: actor.id, approvedById: actor.id, contractSignedByPresident: true, contractSignedByEmployee: true, contractExecutedAt: new Date('2026-10-04'),
      probationPeriodMonths: policy.isSaga && category === 'TEACHING' ? 12 : 6,
      probationaryTerms: policy.isSaga && category === 'TEACHING' ? 'One school year, exact dates in the contract.' : 'Six calendar months; agreed documented synthetic evaluation standards.',
    } });
    const templates = getOnboardingTaskTemplates(policy, category);
    const process = await client.onboardingProcess.create({ data: {
      applicationId: application.id, status: 'COMPLETED', startDate: new Date('2026-10-04'), completedAt: new Date('2026-10-05'), notes: 'Synthetic historical completion notes',
      tasks: { create: templates.filter((_, index) => !options.incomplete || index !== 0).map(task => ({ title: task.title, type: task.type, isRequired: task.isRequired, status: 'VERIFIED', verifiedAt: new Date('2026-10-05'), verifiedById: actor.id, reviewerNotes: 'Synthetic historical verification' })) },
    }, include: { tasks: true } });
    return { application, applicant, job, process, actor, policy, category, owner };
  }
  const include = { applicant: true, job: { include: { organization: true } }, recruitmentDocuments: true, interviews: { include: { evaluation: true } }, assessments: true, offers: true, onboarding: { include: { tasks: true } }, employee: true };
  async function source(client, id) {
    const app = await client.application.findUniqueOrThrow({ where: { id }, include });
    const { resolveHiringDocumentPolicy } = require('../src/features/hiring/document-policy.ts');
    return { ...app, jobCategory: app.job.category, hiringPolicy: resolveHiringDocumentPolicy(app.job.organization, app.job.category), interviews: app.interviews.map(iv => ({ ...iv, recommendation: iv.evaluation?.recommendation })) };
  }
  async function cleanup() {
    // Only IDs created by this invocation are eligible. No stale-run deletion.
    const orgs = await db.organization.findMany({ where: { id: { in: owned.organizations } }, select: { id: true, slug: true } });
    assert(orgs.every(org => org.slug.startsWith(marker + '-')));
    await db.$transaction(async tx => {
      await tx.employee.deleteMany({ where: { sourceApplicationId: { in: owned.applications } } });
      await tx.application.deleteMany({ where: { id: { in: owned.applications } } });
      await tx.job.deleteMany({ where: { id: { in: owned.jobs } } });
      await tx.user.deleteMany({ where: { id: { in: owned.users }, email: { startsWith: marker + '-' } } });
      await tx.organization.deleteMany({ where: { id: { in: owned.organizations }, slug: { startsWith: marker + '-' } } });
      await tx.applicant.deleteMany({ where: { id: { in: owned.applicants }, email: { startsWith: marker + '-' } } });
    }, { timeout: 30000 });
    const remaining = await db.application.count({ where: { id: { in: owned.applications } } });
    assert.equal(remaining, 0);
    helper.assertOriginalUnchanged(config);
    return { remainingApplications: remaining, marker, syntheticOrganizationsRemaining: await db.organization.count({ where: { id: { in: owned.organizations } } }) };
  }
  return { db, config, marker, owned, tenant, candidate, source, cleanup, identity, Prisma };
}

function rollbackClient(tx) {
  let sequence = 0, queue = Promise.resolve();
  return new Proxy(tx, { get(target, key) {
    if (key === '$transaction') return operation => {
      const work = async () => {
        const name = 'hiring_verify_' + (++sequence);
        await tx.$executeRawUnsafe('SAVEPOINT ' + name);
        try { const result = await operation(tx); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); return result; }
        catch (error) { await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT ' + name); await tx.$executeRawUnsafe('RELEASE SAVEPOINT ' + name); throw error; }
      };
      const result = queue.then(work); queue = result.catch(() => {}); return result;
    };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
}
module.exports = { context, rollbackClient, save, directory, helper };

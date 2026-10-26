/* eslint-disable @typescript-eslint/no-require-imports -- Real domain/services with synthetic in-memory transaction fixtures. */
// No environment loading, Prisma client, database connection, storage or email writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('tsx/cjs');
const originalLoad = Module._load;
let db, session;
Module._load = function (name, parent, main) {
  if (name === '@/lib/db/prisma') return { prisma: new Proxy({}, { get: (_, key) => db[key] }) };
  if (name === '@/lib/auth/session') return { getSession: async () => session };
  if (name === './document-access') return { getDocumentStaffContext: async () => session };
  if (name === '@/lib/storage') return { localStorageProvider: { upload: () => { throw Error('NO_STORAGE_WRITES'); } } };
  if (name === 'next/cache') return { revalidatePath: () => {} };
  if (name === 'next/navigation') return { redirect: () => { throw Error('UNEXPECTED_REDIRECT'); } };
  return originalLoad.call(this, name, parent, main);
};
const { Prisma } = require('@prisma/client');
const { resolveHiringDocumentPolicy } = require('../src/features/hiring/document-policy.ts');
const { getOnboardingTaskTemplates, evaluateOnboardingChecklist } = require('../src/features/hiring/onboarding-pipeline.ts');
const { calculateHiringReadiness, calculateHiringPrerequisites } = require('../src/features/hiring/readiness.ts');
const { getStageTransitionBlockers } = require('../src/features/hiring/stage-prerequisites.ts');
const { getHiringLifecycle } = require('../src/features/hiring/lifecycle.ts');
const { transitionApplicationStatus } = require('../src/features/hiring/status-transition.ts');
const { convertApplicationToEmployee } = require('../src/features/employees/conversion.ts');
const { completeOnboardingAction, updateOnboardingTaskStatusAction } = require('../src/features/hiring/onboarding-actions.ts');
const { updateApplicationStatusAction, getApplicationTransitionOptionsAction } = require('../src/features/hiring/actions.ts');
let checks = 0;
function check(label, fn) { fn(); checks++; console.log('PASS ' + label); }
function organization(isSaga = true) { return { id: 'org', slug: isSaga ? 'st-aloysius' : 'synthetic-company', hiringDocumentRequirements: null }; }
function ready(category = 'TEACHING', org = organization()) {
  const policy = resolveHiringDocumentPolicy(org, category);
  return {
    id: 'app', status: 'OFFER', jobCategory: category, hiringPolicy: policy,
    applicant: { id: 'applicant', firstName: 'Synthetic', lastName: 'Candidate', email: 'candidate@fixture.invalid' },
    recruitmentDocuments: policy.requirements.map(def => ({ ...def, status: 'VERIFIED' })),
    assessments: [{ id: 'exam', title: 'Written Examination', type: 'WRITTEN_EXAMINATION', status: 'PASSED', score: 90, passingScore: 75 }],
    interviews: (policy.isSaga ? ['INITIAL_SCREENING', ...(category === 'TEACHING' ? ['TEACHING_DEMONSTRATION'] : []), 'HEAD_OF_DEPARTMENT', 'PRESIDENT_FINAL'] : ['INITIAL_SCREENING'])
      .map((type, i) => ({ id: 'iv-' + i, type, status: 'COMPLETED', recommendation: 'RECOMMEND' })),
    offers: [{ id: 'offer', status: 'ACCEPTED', startDate: new Date('2026-11-01'), salary: 35000, employmentType: 'Full-time', contractSignedByPresident: true, contractSignedByEmployee: true }],
    onboarding: { id: 'process', status: 'COMPLETED', tasks: getOnboardingTaskTemplates(policy, category).map((task, i) => ({ ...task, id: 'task-' + i, status: 'VERIFIED' })) },
  };
}

for (const category of ['TEACHING', 'NON_TEACHING']) {
  const base = ready(category);
  check(category + ' complete checklist passes; evaluation is read-only', () => {
    const before = JSON.stringify(base);
    assert(calculateHiringReadiness(base).isReadyToHire);
    assert.equal(JSON.stringify(base), before);
  });
  for (const status of ['IN_PROGRESS', 'COMPLETED']) {
    for (const tasks of [[], [base.onboarding.tasks.at(-1)], base.onboarding.tasks.slice(1)]) {
      check(category + ' missing requirements block even when ' + status + ' (' + tasks.length + ' tasks)', () => {
        const result = calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, status, tasks } });
        assert(!result.isReadyToHire);
        assert(result.unmetRequirements.some(reason => /checklist|Missing/.test(reason)));
      });
    }
  }
  check(category + ' WAIVED requirements preserved and accepted', () => {
    const tasks = base.onboarding.tasks.map(task => ({ ...task, status: 'WAIVED', reviewerNotes: 'Synthetic HR waiver' }));
    const before = JSON.stringify(tasks);
    assert(calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, tasks } }).isReadyToHire);
    assert.equal(JSON.stringify(tasks), before);
  });
  check(category + ' required template cannot be bypassed by stored optional flag', () => {
    const tasks = base.onboarding.tasks.map(task => ({ ...task, isRequired: false, status: 'PENDING' }));
    assert(!calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, tasks } }).isReadyToHire);
  });
  check(category + ' documented legacy TOR/diploma aliases preserve evidence', () => {
    const tasks = base.onboarding.tasks.filter(task => !['Transcript of Records (TOR)', 'Photocopy of Diploma'].includes(task.title));
    tasks.push({ id: 'legacy', title: 'Official Transcript of Records (TOR) & Diploma', isRequired: true, status: 'VERIFIED' });
    assert(calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, tasks } }).isReadyToHire);
    tasks.at(-1).title = 'Unknown legacy credential';
    assert(!calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, tasks } }).isReadyToHire);
  });
  check(category + ' CANCELLED onboarding blocks; legacy HIRED prerequisites rechecked', () => {
    assert(!calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, status: 'CANCELLED' } }).isReadyToHire);
    assert(!calculateHiringPrerequisites({ ...base, status: 'HIRED', onboarding: { ...base.onboarding, tasks: [] } }).isReadyToHire);
    assert.equal(calculateHiringReadiness({ ...base, status: 'HIRED' }).overallStatus, 'HIRED');
  });
  for (const target of ['SHORTLISTED', 'INTERVIEW', 'ASSESSMENT', 'OFFER']) {
    const from = { SHORTLISTED: 'SCREENING', INTERVIEW: 'SHORTLISTED', ASSESSMENT: 'INTERVIEW', OFFER: 'ASSESSMENT' }[target];
    check(category + ' legitimate ' + from + ' -> ' + target, () => assert.deepEqual(getStageTransitionBlockers({ ...base, status: from }, target), []));
    check(category + ' missing policy documents block ' + target, () => assert(getStageTransitionBlockers({ ...base, status: from, recruitmentDocuments: [] }, target).length));
  }
  check(category + ' initial screening cannot advance while scheduled/unapproved/no-show', () => {
    for (const interview of [{ status: 'SCHEDULED' }, { status: 'COMPLETED', recommendation: null }, { status: 'COMPLETED', recommendation: 'DO_NOT_RECOMMEND' }, { status: 'COMPLETED', recommendation: 'MAYBE' }, { status: 'NO_SHOW' }]) {
      assert(getStageTransitionBlockers({ ...base, status: 'INTERVIEW', interviews: [{ id: 'initial', type: 'INITIAL_SCREENING', ...interview }] }, 'ASSESSMENT').length);
    }
  });
  check(category + ' SAGA institutional interviews do not precede entry into examinations', () => {
    const interviews = base.interviews.map(iv => iv.type === 'INITIAL_SCREENING' ? iv : { ...iv, status: 'SCHEDULED', recommendation: null });
    assert.deepEqual(getStageTransitionBlockers({ ...base, status: 'INTERVIEW', assessments: [], interviews }, 'ASSESSMENT'), []);
    assert(getStageTransitionBlockers({ ...base, status: 'ASSESSMENT', interviews }, 'OFFER').length);
  });
  check(category + ' missing exam/end endorsements block OFFER and final hiring', () => {
    for (const patch of [{ assessments: [] }, { interviews: [] }, { interviews: base.interviews.map(iv => ({ ...iv, recommendation: null })) }]) {
      assert(getStageTransitionBlockers({ ...base, ...patch, status: 'ASSESSMENT' }, 'OFFER').length);
      assert(!calculateHiringReadiness({ ...base, ...patch }).isReadyToHire);
    }
  });
  check(category + ' failed/expired/pending/below-threshold exams block', () => {
    for (const exam of [{ status: 'FAILED' }, { status: 'EXPIRED' }, { status: 'UNDER_REVIEW' }, { status: 'PASSED', score: 30 }]) {
      const source = { ...base, assessments: [{ ...base.assessments[0], ...exam }] };
      assert(!calculateHiringReadiness(source).isReadyToHire);
      assert(getStageTransitionBlockers({ ...source, status: 'ASSESSMENT' }, 'OFFER').length);
    }
  });
  check(category + ' individual missing/negative institutional approvals and unsigned contracts block', () => {
    for (const type of ['HEAD_OF_DEPARTMENT', 'PRESIDENT_FINAL', ...(category === 'TEACHING' ? ['TEACHING_DEMONSTRATION'] : [])]) {
      for (const interviews of [base.interviews.filter(iv => iv.type !== type), base.interviews.map(iv => iv.type === type ? { ...iv, recommendation: 'DO_NOT_RECOMMEND' } : iv)]) {
        assert(!calculateHiringReadiness({ ...base, interviews }).isReadyToHire);
        assert(getStageTransitionBlockers({ ...base, interviews, status: 'ASSESSMENT' }, 'OFFER').length);
      }
    }
    for (const signature of ['contractSignedByPresident', 'contractSignedByEmployee']) {
      assert(!calculateHiringReadiness({ ...base, offers: [{ ...base.offers[0], [signature]: false }] }).isReadyToHire);
    }
  });
}
check('non-teaching policy excludes mandatory LET and demonstration', () => {
  const base = ready('NON_TEACHING');
  assert(!getOnboardingTaskTemplates(base.hiringPolicy, 'NON_TEACHING').some(task => task.matchedRecruitmentDocType === 'LET_BASIC_EDUCATION'));
  assert(calculateHiringReadiness(base).isReadyToHire);
});
check('custom tenant policy remains distinct, including category-specific requirements', () => {
  const def = { type: 'OTHER', title: 'Synthetic custom certificate', isRequired: true, isConditional: false, submissionTarget: 'HR' };
  const org = { ...organization(false), hiringDocumentRequirements: { TEACHING: [def], NON_TEACHING: [] } };
  const base = ready('TEACHING', org);
  assert(calculateHiringReadiness(base).isReadyToHire);
  assert(!calculateHiringReadiness({ ...base, onboarding: { ...base.onboarding, tasks: [base.onboarding.tasks.at(-1)] } }).isReadyToHire);
  assert(calculateHiringReadiness(ready('NON_TEACHING', org)).isReadyToHire);
  assert(!base.onboarding.tasks.some(task => /SAGA|LET/.test(task.title)));
});
check('rejection/withdrawal remain allowed; skipping/terminal progression invalid', () => {
  for (const target of ['REJECTED', 'WITHDRAWN']) assert.deepEqual(getStageTransitionBlockers({ status: 'INTERVIEW' }, target), []);
  for (const status of ['APPLIED', 'REJECTED', 'WITHDRAWN', 'HIRED']) assert(getStageTransitionBlockers({ status }, 'OFFER').length);
});
check('lifecycle numbering matches shared tracker model for every category/status', () => {
  for (const isSaga of [true, false]) for (const category of ['TEACHING', 'NON_TEACHING']) {
    for (const currentStatus of ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']) {
      const state = getHiringLifecycle({ isSaga, category, currentStatus });
      assert.equal(state.steps.length, isSaga ? category === 'TEACHING' ? 10 : 9 : 7);
      assert(state.activeIndex >= 0 && state.activeIndex < state.steps.length);
      if (currentStatus === 'OFFER') assert.equal(state.steps[state.activeIndex].key, 'CONTRACT');
      if (currentStatus === 'HIRED') assert.equal(state.activeIndex, state.steps.length - 1);
      if (['REJECTED', 'WITHDRAWN'].includes(currentStatus)) assert(state.isTerminal);
    }
  }
});

function stored(source = ready()) {
  return { ...source, applicantId: source.applicant.id, job: { id: 'job', title: 'Synthetic job', department: 'Synthetic', category: source.jobCategory, organizationId: 'org', organization: organization() },
    history: [], employee: null,
    interviews: source.interviews.map(iv => ({ ...iv, evaluation: { recommendation: iv.recommendation } })),
  };
}
session = { userId: 'hr', name: 'Synthetic HR', email: 'hr@fixture.invalid', organizationId: 'org', role: 'HR_ADMIN' };
const actor = () => ({ ...session, id: session.userId });
let state, version, writes, forceConflict;
function setup(source = stored()) {
  state = structuredClone(source); version = 0; writes = 0; forceConflict = false;
  db = {
    user: { findFirst: async ({ where }) => where.organizationId === session?.organizationId && where.id === session?.userId ? actor() : null },
    application: { findFirst: async ({ where }) => where.id === state.id && where.job.organizationId === state.job.organizationId ? structuredClone(state) : null },
    employee: { findUnique: async () => null },
    $transaction: async (operation, options) => {
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
      const readVersion = version, snapshot = structuredClone(state);
      let localWrites = 0;
      const tx = {
        ...db,
        application: {
          findFirst: async args => db.application.findFirst(args),
          updateMany: async ({ where, data }) => {
            assert.equal(where.job.organizationId, 'org');
            if (snapshot.status !== where.status) return { count: 0 };
            Object.assign(snapshot, data); localWrites++; return { count: 1 };
          },
          update: async ({ data }) => { Object.assign(snapshot, data); localWrites++; },
        },
        applicationStatusHistory: { create: async ({ data }) => { snapshot.history.push(data); localWrites++; } },
        candidateAccess: { upsert: async () => { localWrites++; } },
        employeeNumberSequence: { upsert: async () => { localWrites++; return { nextValue: 2 }; } },
        employee: { ...db.employee, create: async () => { localWrites++; snapshot.employee = { id: 'employee', employeeNumber: 'SYN-2026-0001', employmentRecords: [] }; return snapshot.employee; } },
        employmentRecord: { create: async () => { localWrites++; const record = { id: 'employment', effectiveTo: null }; snapshot.employee.employmentRecords.push(record); return record; } },
        probationRecord: { create: async () => { localWrites++; snapshot.employee.employmentRecords[0].probation = { id: 'probation' }; } },
        employeeStatusHistory: { create: async () => { localWrites++; } },
      };
      const result = await operation(tx);
      if (localWrites && (forceConflict || readVersion !== version)) throw new Prisma.PrismaClientKnownRequestError('Synthetic serialization conflict', { code: 'P2034', clientVersion: 'synthetic' });
      if (localWrites) { state = snapshot; writes += localWrites; version++; }
      return result;
    },
  };
}

(async () => {
  setup(stored({ ...ready(), status: 'INTERVIEW' }));
  assert((await updateApplicationStatusAction('app', 'ASSESSMENT')).success);
  assert.equal(state.status, 'ASSESSMENT'); assert.equal(state.history.length, 1);
  assert.equal(state.history[0].fromStatus, 'INTERVIEW');
  const before = writes;
  assert((await updateApplicationStatusAction('app', 'ASSESSMENT')).success);
  assert.equal(writes, before);
  check('actual stage action/service atomically records transition and duplicate is idempotent', () => {});
  for (const role of ['EMPLOYEE', 'HIRING_MANAGER']) {
    session.role = role; assert((await updateApplicationStatusAction('app', 'OFFER')).error); assert.equal(writes, before);
  }
  session.role = 'HR_ADMIN';
  assert((await transitionApplicationStatus({ applicationId: 'app', organizationId: 'foreign', actorUserId: 'hr', target: 'OFFER' })).error);
  assert((await updateApplicationStatusAction('app', 'HIRED')).error);
  check('actual action/service preserve role, tenant, and conversion-only HIRED checks', () => {});
  setup(stored({ ...ready(), status: 'INTERVIEW', interviews: [{ id: 'pending', type: 'INITIAL_SCREENING', status: 'SCHEDULED' }] }));
  const options = await getApplicationTransitionOptionsAction('app');
  assert(options.options.find(option => option.status === 'ASSESSMENT').blockers.length);
  assert((await updateApplicationStatusAction('app', 'ASSESSMENT')).error); assert.equal(writes, 0);
  assert((await updateApplicationStatusAction('app', 'REJECTED')).success);
  check('read-only frontend restrictions match stage enforcement; rejection stays available', () => {});
  setup(stored({ ...ready(), status: 'INTERVIEW' }));
  const input = { applicationId: 'app', organizationId: 'org', actorUserId: 'hr', target: 'ASSESSMENT' };
  const concurrent = await Promise.all([transitionApplicationStatus(input), transitionApplicationStatus(input)]);
  assert.equal(concurrent.filter(result => result.success).length, 1);
  assert.equal(state.history.length, 1);
  assert(concurrent.some(result => /concurrently/.test(result.error)));
  check('concurrent synthetic transactions commit once; loser reports review/retry', () => {});
  // Reproduce the old stale-read algorithm: a stale ASSESSMENT -> OFFER write
  // can overwrite a later HIRED value because its UPDATE had no status predicate.
  const legacy = { status: 'ASSESSMENT', history: [] };
  const staleStatus = legacy.status;
  legacy.status = 'OFFER'; legacy.status = 'HIRED'; legacy.history.push({ fromStatus: 'OFFER', toStatus: 'HIRED' });
  legacy.status = 'OFFER'; legacy.history.push({ fromStatus: staleStatus, toStatus: 'OFFER' });
  assert.equal(legacy.status, 'OFFER'); assert(legacy.history.some(event => event.toStatus === 'HIRED'));
  setup(stored({ ...ready(), status: 'HIRED' }));
  assert((await transitionApplicationStatus({ ...input, target: 'OFFER' })).error); assert.equal(writes, 0);
  check('old stale update reproduces HIRED history/OFFER status; current service rejects terminal overwrite', () => {});
  setup({ ...stored(), employee: { id: 'existing-employee' } });
  assert((await transitionApplicationStatus({ ...input, target: 'REJECTED' })).error);
  assert.equal(writes, 0); assert.equal(state.status, 'OFFER');
  check('legacy OFFER/employee mismatch requires HR review and remains untouched', () => {});
  for (const tasks of [[], [ready().onboarding.tasks.at(-1)], ready().onboarding.tasks.map(task => ({ ...task, status: 'PENDING' }))]) {
    setup(stored({ ...ready(), onboarding: { ...ready().onboarding, status: 'COMPLETED', tasks } }));
    await assert.rejects(convertApplicationToEmployee({ applicationId: 'app', organizationId: 'org', actorUserId: 'hr' }), error => error.code === 'NOT_READY');
    assert.equal(writes, 0);
  }
  check('actual employee conversion blocks incomplete COMPLETED checklists before any writes', () => {});
  // Stop at the existing probation validation after passing readiness: this proves
  // complete fixtures reach later safeguards without weakening or exercising them.
  setup();
  await assert.rejects(convertApplicationToEmployee({ applicationId: 'app', organizationId: 'org', actorUserId: 'hr' }), error => ['INVALID_OFFER', 'INVALID_PROBATION_DATE'].includes(error.code));
  assert.equal(writes, 0);
  check('complete readiness reaches downstream conversion safeguards without writes', () => {});
  const conversionInput = { applicationId: 'app', organizationId: 'org', actorUserId: 'hr', teachingExpectedEndAt: new Date('2027-10-31') };
  const converted = await convertApplicationToEmployee(conversionInput);
  assert.equal(converted.employeeId, 'employee'); assert.equal(state.status, 'HIRED');
  assert.equal(state.history.length, 1); assert.equal(state.history[0].fromStatus, 'OFFER'); assert.equal(state.history[0].toStatus, 'HIRED');
  const conversionWrites = writes;
  assert((await convertApplicationToEmployee(conversionInput)).idempotent); assert.equal(writes, conversionWrites);
  check('actual conversion creates synthetic employee/employment/probation and HIRED audit atomically; retry is idempotent', () => {});
  setup();
  const competing = await Promise.allSettled([
    transitionApplicationStatus({ ...input, target: 'REJECTED' }),
    convertApplicationToEmployee(conversionInput),
  ]);
  assert(competing.some(result => result.status === 'fulfilled'));
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].toStatus, state.status);
  assert.equal(Boolean(state.employee), state.status === 'HIRED');
  check('simulated concurrent rejection/conversion retain one consistent status/audit and no partial employee', () => {});
  // Exercise manual and automatic completion against incomplete institutional tasks.
  setup();
  const tasks = [{ id: 'task', title: 'Legacy review', status: 'SUBMITTED', isRequired: true }];
  const process = { id: 'process', applicationId: 'app', status: 'IN_PROGRESS', tasks, application: { job: state.job } };
  let completionWrites = 0;
  db.onboardingProcess = {
    findFirst: async args => { assert.equal(args.where.application.job.organizationId, 'org'); return process; },
    update: async () => { completionWrites++; },
  };
  db.onboardingTask = {
    findFirst: async () => ({ ...tasks[0], onboardingProcessId: 'process', onboardingProcess: process }),
    update: async ({ data }) => Object.assign(tasks[0], data),
    findMany: async () => tasks,
  };
  // Onboarding actions use the same transaction contract, but never need commit here.
  db.$transaction = async fn => fn(db);
  assert((await completeOnboardingAction('process')).error);
  assert((await updateOnboardingTaskStatusAction('task', 'VERIFIED')).success);
  assert.equal(completionWrites, 0); assert.equal(tasks[0].status, 'VERIFIED');
  assert.equal(evaluateOnboardingChecklist(tasks, ready().hiringPolicy, 'TEACHING').isComplete, false);
  check('manual/automatic completion cannot mark a partial institutional checklist complete; verified record retained', () => {});
  console.log('PASS ' + checks + ' synthetic functional regression groups; no database/network/storage access');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = originalLoad; });

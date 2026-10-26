/* eslint-disable @typescript-eslint/no-require-imports -- Verification-only runner; no database writes or application edits. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const directory = process.env.WP_VERIFICATION_DIRECTORY || 'docs/hiring-postfix-verification';
const files = [
  'docs/hiring-functional-fixes-2026-10-26.md', 'scripts/test-hiring-functional-fixes.cjs', 'scripts/test-hiring-policy.cjs',
  'src/features/hiring/actions.ts', 'src/features/hiring/onboarding-actions.ts', 'src/features/hiring/onboarding-pipeline.ts',
  'src/features/hiring/readiness.ts', 'src/features/hiring/qualification.ts', 'src/features/hiring/stage-prerequisites.ts',
  'src/features/hiring/status-transition.ts', 'src/features/hiring/lifecycle.ts',
  'src/components/hiring/ApplicantProfileView.tsx', 'src/components/hiring/HiringProgressTracker.tsx',
  'src/components/hiring/StatusChangeDialog.tsx', 'src/app/(dashboard)/dashboard/hiring/applicants/[applicationId]/page.tsx',
  'src/features/hiring/onboarding-audit.ts', 'src/components/hiring/HiringReadinessCard.tsx',
  'src/components/hiring/OnboardingTaskReviewModal.tsx', 'scripts/verify-hiring-postfix.cjs',
];
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function save(name, result) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name + '.json'), JSON.stringify({ capturedAt: new Date().toISOString(), ...result }, null, 2) + '\n');
}
async function database() {
  const helper = require('./batch0-recovery-environment.cjs');
  const { PrismaClient, Prisma } = require('@prisma/client');
  const config = helper.configuration();
  // Independently confirmed through Neon control-plane tools in this review.
  assert.equal(config.identity.branchId, 'br-damp-fog-azmmxhga');
  assert.equal(config.identity.endpointId, 'ep-wild-mud-az8yzifu');
  assert(config.identity.distinctFromProtectedOriginal);
  const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  try {
    const [identity] = await db.$queryRaw`SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id,current_setting('neon.project_id',true) AS project_id`;
    assert.equal(identity.branch_id, config.identity.branchId);
    assert.equal(identity.endpoint_id, config.identity.endpointId);
    assert.equal(identity.project_id, 'late-block-61364102');
    assert.equal(identity.schema, 'public'); assert.equal(identity.database, 'neondb'); assert.equal(identity.read_only, 'on');
    const columns = await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'`;
    const missingColumns = [];
    for (const model of Prisma.dmmf.datamodel.models) {
      for (const field of model.fields.filter(field => field.kind !== 'object')) {
        if (!columns.some(column => column.table_name === (model.dbName || model.name) && column.column_name === (field.dbName || field.name))) missingColumns.push(model.name + '.' + field.name);
      }
    }
    const values = await db.$queryRaw`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'`;
    const missingEnums = [];
    for (const type of Prisma.dmmf.datamodel.enums) for (const value of type.values) {
      if (!values.some(row => row.typname === (type.dbName || type.name) && row.enumlabel === (value.dbName || value.name))) missingEnums.push(type.name + '.' + value.name);
    }
    const migrations = await db.$queryRaw`SELECT migration_name,checksum,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY migration_name`;
    const localMigrations = fs.readdirSync('prisma/migrations').filter(name => fs.existsSync('prisma/migrations/' + name + '/migration.sql'));
    const pending = localMigrations.filter(name => !migrations.some(row => row.migration_name === name && row.finished && !row.rolled_back));
    const unresolved = migrations.filter(row => !row.finished && !row.rolled_back).map(row => row.migration_name);
    const checksumMismatches = migrations.filter(row => row.finished && !row.rolled_back).filter(row => {
      const file = 'prisma/migrations/' + row.migration_name + '/migration.sql';
      if (!fs.existsSync(file)) return true;
      const sql = fs.readFileSync(file, 'utf8');
      return ![sql, sql.replace(/\r\n/g, '\n'), sql.replace(/\r?\n/g, '\r\n')].some(text => createHash('sha256').update(text).digest('hex') === row.checksum);
    }).map(row => row.migration_name);
    const migrationPath = 'prisma/migrations/20261026000000_stage_document_requests/migration.sql';
    const originalDocumentColumns = Prisma.dmmf.datamodel.models.find(model => model.name === 'RecruitmentDocument').fields
      .filter(field => field.kind !== 'object' && field.name !== 'requestedAt').map(field => '"' + (field.dbName || field.name).replaceAll('"', '""') + '"');
    const migrationReview = {
      path: migrationPath, sha256: hash(migrationPath), sql: fs.readFileSync(migrationPath, 'utf8').trim(),
      checksumMismatches,
      columnBefore: await db.$queryRaw`SELECT column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='RecruitmentDocument' AND column_name='requestedAt'`,
      server: await db.$queryRaw`SELECT current_setting('server_version') AS version`,
      table: await db.$queryRaw`SELECT count(*)::int AS row_count FROM "RecruitmentDocument"`,
      originalDocumentColumns,
      existingRecordFingerprint: await db.$queryRawUnsafe('SELECT count(*)::int AS row_count,md5(coalesce(string_agg(md5(row_to_json(x)::text),\'\' ORDER BY md5(row_to_json(x)::text)),\'\')) AS fingerprint FROM (SELECT ' + originalDocumentColumns.join(',') + ' FROM public."RecruitmentDocument") x'),
      locks: await db.$queryRaw`SELECT mode,granted,count(*)::int AS lock_count FROM pg_locks WHERE relation=to_regclass('public."RecruitmentDocument"') GROUP BY mode,granted`,
      automaticApplyAllowed: false,
    };
    let prismaRead = 'PASS';
    try { await db.recruitmentDocument.findFirst({ select: { requestedAt: true } }); }
    catch (error) { prismaRead = error.code || error.name; }
    helper.assertOriginalUnchanged(config);
    const result = { identity, isolation: 'PASS', schema: missingColumns.length || missingEnums.length || unresolved.length || checksumMismatches.length ? 'BLOCKED' : 'PASS', modelsCompared: Prisma.dmmf.datamodel.models.length, missingColumns, missingEnums, appliedMigrations: migrations.filter(row => row.finished && !row.rolled_back).length, pendingMigrations: pending, unresolvedMigrations: unresolved, prismaRequestedAtRead: prismaRead, migrationReview, databaseWrites: 0, migrationsExecuted: 0, productionRecordQueries: 0, originalEnvUnchanged: true };
    save('database-preflight', result); console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); }
}
async function lint() {
  const { ESLint } = require('eslint');
  const eslint = new ESLint();
  const changed = await eslint.lintFiles(files.filter(file => !file.endsWith('.md')));
  const total = await eslint.lintFiles(['.']);
  const counts = rows => ({ errors: rows.reduce((n, row) => n + row.errorCount, 0), warnings: rows.reduce((n, row) => n + row.warningCount, 0) });
  const result = { changedFiles: counts(changed), repository: counts(total), changedFileDiagnostics: changed.filter(row => row.messages.length).map(row => ({ file: path.relative(process.cwd(), row.filePath), messages: row.messages })), repositoryProblemFiles: total.filter(row => row.messages.length).map(row => ({ file: path.relative(process.cwd(), row.filePath), errors: row.errorCount, warnings: row.warningCount })) };
  save('eslint', result); console.log(JSON.stringify({ changedFiles: result.changedFiles, repository: result.repository }));
  assert.equal(result.changedFiles.errors, 0); assert.equal(result.changedFiles.warnings, 0);
}
async function components() {
  const Module = require('node:module');
  require('tsx/cjs');
  const original = Module._load;
  Module._load = function (name, parent, main) {
    if (name === 'next/navigation') return { useRouter: () => ({ push() {}, refresh() {} }) };
    if (name === '@/features/employees/actions') return { convertApplicationToEmployeeAction: () => { throw Error('RENDER_MUST_NOT_CONVERT'); } };
    if (name === '@/features/hiring/onboarding-actions') return { updateOnboardingTaskStatusAction: () => { throw Error('RENDER_MUST_NOT_UPDATE'); } };
    if (name === '@/lib/db/prisma') throw Error('NO_DATABASE_ACCESS_IN_COMPONENT_TEST');
    return original.call(this, name, parent, main);
  };
  try {
    const React = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const { resolveHiringDocumentPolicy } = require('../src/features/hiring/document-policy.ts');
    const { getOnboardingTaskTemplates } = require('../src/features/hiring/onboarding-pipeline.ts');
    const { calculateHiringReadiness } = require('../src/features/hiring/readiness.ts');
    const { HiringReadinessCard } = require('../src/components/hiring/HiringReadinessCard.tsx');
    const { OnboardingTaskReviewModal } = require('../src/components/hiring/OnboardingTaskReviewModal.tsx');
    const checks = [];
    for (const isSaga of [true, false]) for (const category of ['TEACHING', 'NON_TEACHING']) {
      const policy = resolveHiringDocumentPolicy({ id: 'synthetic-org', slug: isSaga ? 'st-aloysius' : 'synthetic-company', hiringDocumentRequirements: null }, category);
      const base = {
        id: 'synthetic-app', status: 'OFFER', jobCategory: category, hiringPolicy: policy,
        applicant: { firstName: 'Synthetic', lastName: 'Candidate', email: 'synthetic@fixture.invalid' },
        recruitmentDocuments: policy.requirements.map(def => ({ ...def, status: 'VERIFIED' })),
        assessments: [{ id: 'exam', title: 'Written Examination', type: 'WRITTEN_EXAMINATION', status: 'PASSED', score: 90, passingScore: 75 }],
        interviews: (isSaga ? ['HEAD_OF_DEPARTMENT', 'PRESIDENT_FINAL', ...(category === 'TEACHING' ? ['TEACHING_DEMONSTRATION'] : [])] : []).map(type => ({ id: type, type, status: 'COMPLETED', recommendation: 'RECOMMEND' })),
        offers: [{ id: 'offer', status: 'ACCEPTED', startDate: new Date('2026-11-01'), employmentType: 'Full-time', salary: 35000, contractSignedByEmployee: true, contractSignedByPresident: true }],
        onboarding: { id: 'process', status: 'COMPLETED', tasks: getOnboardingTaskTemplates(policy, category).map((task, index) => ({ ...task, id: String(index), status: 'VERIFIED' })) },
      };
      const render = source => renderToStaticMarkup(React.createElement(HiringReadinessCard, { applicationId: source.id, candidateName: 'Synthetic Candidate', jobTitle: 'Synthetic job', readiness: calculateHiringReadiness(source), canManage: true, currentStatus: source.status, employmentCategory: category, isSagaOrganization: isSaga }));
      assert(calculateHiringReadiness(base).isReadyToHire);
      for (const tasks of [[], base.onboarding.tasks.slice(1)]) {
        const source = { ...base, onboarding: { ...base.onboarding, tasks } };
        const readiness = calculateHiringReadiness(source);
        assert(!readiness.isReadyToHire);
        assert(readiness.checklist.filter(item => item.key !== 'onboarding').every(item => item.isComplete));
        const html = render(source);
        const button = html.match(/<button\b[^>]*>Hire Candidate<\/button>/)?.[0];
        assert(button && /disabled/.test(button)); assert(html.includes('NOT READY TO HIRE'));
        checks.push({ isSaga, category, taskCount: tasks.length, status: 'PASS', disabledHireButton: true });
      }
      const waived = { ...base, onboarding: { ...base.onboarding, tasks: base.onboarding.tasks.map(task => ({ ...task, status: 'WAIVED' })) } };
      assert(calculateHiringReadiness(waived).isReadyToHire);
      const legacy = { ...base, status: 'HIRED', onboarding: { ...base.onboarding, tasks: [] } };
      const legacyHtml = render(legacy);
      const recoveryButton = html => html.replace(/\s+/g, ' ').match(/<button\b[^>]*>Complete Employee Record<\/button>/)?.[0];
      const isDisabled = button => /\sdisabled(?:=|\s|>)/.test(button || '');
      assert(isDisabled(recoveryButton(legacyHtml)));
      assert(legacyHtml.includes('blocked until current requirements are satisfied'));
      assert.equal(calculateHiringReadiness(legacy).canCompleteEmployeeRecord, false);
      checks.push({ isSaga, category, legacyHired: true, status: 'PASS', missingTasksBlockRecovery: true });
      const missingDocuments = { ...base, status: 'HIRED', recruitmentDocuments: [] };
      assert(isDisabled(recoveryButton(render(missingDocuments))));
      checks.push({ isSaga, category, status: 'PASS', missingDocumentsBlockRecovery: true });
      const completeLegacy = { ...base, status: 'HIRED' };
      assert.equal(calculateHiringReadiness(completeLegacy).canCompleteEmployeeRecord, true);
      assert(recoveryButton(render(completeLegacy)) && !isDisabled(recoveryButton(render(completeLegacy))));
      checks.push({ isSaga, category, status: 'PASS', completeLegacyRecoveryEnabled: true });
    }
    for (const status of ['VERIFIED', 'WAIVED']) {
      const html = renderToStaticMarkup(React.createElement(OnboardingTaskReviewModal, {
        task: { id: 'task', title: 'Synthetic historical evidence', type: 'DOCUMENT', status, isRequired: true, reviewerNotes: 'Old reviewer notes must not become a new reopening reason', dueDate: null, submittedAt: null, verifiedAt: null, storageKey: null },
        candidateName: 'Synthetic Candidate', isOpen: true, onClose() {},
      }));
      const reopenButton = html.match(/<button\b[\s\S]*?<\/button>/g).find(button => button.includes('Reopen Item'));
      assert(/\sdisabled(?:=|\s|>)/.test(reopenButton));
      assert(html.includes('Reason for Reopening (Required)'));
      assert(!html.includes('Old reviewer notes must not become a new reopening reason'));
      checks.push({ taskStatus: status, status: 'PASS', reopeningReasonRequired: true, reopeningInitiallyDisabled: true });
    }
    save('rendered-components', { status: 'PASS', liveBrowser: false, checks });
    console.log(JSON.stringify({ renderedComponentChecks: checks.length, status: 'PASS', liveBrowser: false }));
  } finally { Module._load = original; }
}
function regressions() {
  const checks = [];
  for (const script of ['test-hiring-functional-fixes.cjs', 'test-hiring-policy.cjs', 'test-hiring-candidate-security.cjs', 'test-candidate-document-headers.cjs', 'test-final-ux-hiring.cjs']) {
    const result = spawnSync(process.execPath, ['scripts/' + script], { encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', PLATFORM_ROOT_DOMAIN: 'localhost' }, timeout: 60000, windowsHide: true });
    checks.push({ script, exitCode: result.status, status: result.status === 0 ? 'PASS' : 'FAIL', output: result.stdout.trim(), error: result.stderr.trim() });
  }
  save('synthetic-regressions', { checks });
  console.log(JSON.stringify(checks.map(({ script, status, exitCode }) => ({ script, status, exitCode }))));
  assert(checks.every(check => check.status === 'PASS'));
}
async function boundaries() {
  const Module = require('node:module');
  const { Prisma } = require('@prisma/client');
  require('tsx/cjs');
  const original = Module._load;
  let actorRole = 'HR_ADMIN', actorOrganization = 'synthetic-org', application, writes = 0;
  const session = { userId: 'hr', role: 'HR_ADMIN', organizationId: 'synthetic-org', name: 'Synthetic HR', email: 'hr@fixture.invalid' };
  const db = {
    user: { findFirst: async ({ where }) => where.id === 'hr' && where.organizationId === actorOrganization && (!where.role?.in || where.role.in.includes(actorRole)) ? { ...session, id: 'hr', role: actorRole } : null },
    application: { findFirst: async ({ where }) => {
      assert(where.job.organizationId);
      return application && where.id === application.id && where.job.organizationId === application.job.organizationId ? application : null;
    } },
    employee: { findUnique: async () => null },
    $transaction: async (operation, options) => {
      assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.Serializable);
      return operation(db);
    },
  };
  Module._load = function (name, parent, main) {
    if (name === '@/lib/db/prisma') return { prisma: db };
    if (name === '@/lib/auth/session') return { getSession: async () => session };
    if (name === './document-access') return { getDocumentStaffContext: async () => session };
    if (name === 'next/cache') return { revalidatePath() {} };
    if (name === '@/lib/storage') return { localStorageProvider: {} };
    return original.call(this, name, parent, main);
  };
  const checks = [];
  try {
    const { transitionApplicationStatus } = require('../src/features/hiring/status-transition.ts');
    const { convertApplicationToEmployee } = require('../src/features/employees/conversion.ts');
    const { updateOnboardingTaskStatusAction, completeOnboardingAction } = require('../src/features/hiring/onboarding-actions.ts');
    const input = { applicationId: 'synthetic-app', organizationId: 'synthetic-org', actorUserId: 'hr' };
    for (const role of ['EMPLOYEE', 'HIRING_MANAGER']) {
      actorRole = role;
      assert((await transitionApplicationStatus({ ...input, target: 'OFFER' })).error);
      await assert.rejects(convertApplicationToEmployee(input), error => error.code === 'APPLICATION_NOT_FOUND');
      checks.push({ check: 'Persisted ' + role + ' cannot change stage or convert despite HR session claims', status: 'PASS' });
    }
    actorRole = 'HR_ADMIN'; actorOrganization = 'foreign-org';
    assert((await transitionApplicationStatus({ ...input, target: 'OFFER' })).error);
    await assert.rejects(convertApplicationToEmployee(input), error => error.code === 'APPLICATION_NOT_FOUND');
    checks.push({ check: 'Foreign actor denied before application access', status: 'PASS' });
    actorOrganization = 'synthetic-org';
    application = { id: input.applicationId, job: { organizationId: 'foreign-org' } };
    assert((await transitionApplicationStatus({ ...input, target: 'OFFER' })).error);
    await assert.rejects(convertApplicationToEmployee(input), error => error.code === 'APPLICATION_NOT_FOUND');
    checks.push({ check: 'Foreign application denied by derived ownership', status: 'PASS' });
    const organization = { id: 'synthetic-org', slug: 'synthetic-company', hiringDocumentRequirements: { TEACHING: [], NON_TEACHING: [] } };
    for (const status of ['OFFER', 'HIRED']) {
      application = { id: input.applicationId, status, applicantId: 'synthetic-person', applicant: { firstName: 'Synthetic', lastName: 'Candidate', email: 'candidate@fixture.invalid' }, job: { organizationId: organization.id, organization, category: 'NON_TEACHING' }, assessments: [], interviews: [], recruitmentDocuments: [], offers: [{ id: 'offer', status: 'ACCEPTED', startDate: new Date('2026-11-01'), salary: 35000, employmentType: 'Full-time' }], employee: null, history: [], onboarding: { id: 'process', status: 'COMPLETED', tasks: [{ id: 'task', title: 'Legacy custom review', isRequired: true, status: 'VERIFIED' }] } };
      const before = JSON.stringify(application);
      await assert.rejects(convertApplicationToEmployee(input), error => error.code === 'NOT_READY');
      assert.equal(JSON.stringify(application), before);
      checks.push({ check: status + ' missing policy task denied by actual conversion with no mutations', status: 'PASS' });
    }
    assert.equal(writes, 0);
    // Review the legacy update path without touching any actual records.
    const task = { id: 'legacy-task', title: 'Legacy custom review', isRequired: true, status: 'SUBMITTED', onboardingProcessId: 'legacy-process' };
    const retained = [
      { id: 'waived-evidence', title: 'Historical waived item', isRequired: true, status: 'WAIVED', reviewerNotes: 'Authorized existing waiver', storageKey: 'synthetic-waived-file' },
      { id: 'verified-evidence', title: 'Historical verified item', isRequired: true, status: 'VERIFIED', verifiedAt: new Date('2026-10-01'), verifiedById: 'original-reviewer', storageKey: 'synthetic-verified-file' },
    ];
    const retainedSnapshot = JSON.stringify(retained);
    const process = { id: 'legacy-process', applicationId: input.applicationId, status: 'COMPLETED', completedAt: new Date('2026-10-01'), notes: 'Historical notes', tasks: [task, ...retained], application: { job: application.job } };
    const historicalCompletedAt = process.completedAt.toISOString();
    db.onboardingTask = {
      findFirst: async ({ where }) => where.onboardingProcess.application.job.organizationId === organization.id ? { ...task, onboardingProcess: process } : null,
      update: async ({ data }) => { writes++; Object.assign(task, data); },
      findMany: async () => process.tasks,
    };
    const processUpdates = [];
    db.candidateAccess = { upsert: async () => { writes++; } };
    db.onboardingProcess = { findFirst: async () => process, update: async ({ data }) => { writes++; processUpdates.push(data); Object.assign(process, data); } };
    session.role = 'HIRING_MANAGER';
    assert((await updateOnboardingTaskStatusAction(task.id, 'VERIFIED')).error);
    session.role = 'HR_ADMIN'; session.organizationId = 'foreign-org';
    assert((await updateOnboardingTaskStatusAction(task.id, 'VERIFIED')).error);
    session.organizationId = organization.id;
    assert.equal(writes, 0);
    checks.push({ check: 'Unauthorized role and foreign tenant cannot verify or reopen onboarding tasks', status: 'PASS' });
    assert((await updateOnboardingTaskStatusAction(task.id, 'VERIFIED')).success);
    const clearedLegacyCompletion = processUpdates.some(data => data.completedAt === null);
    assert.equal(clearedLegacyCompletion, false); assert.equal(processUpdates.length, 0);
    assert.equal(process.completedAt.toISOString(), historicalCompletedAt); assert.equal(process.status, 'COMPLETED');
    assert((await completeOnboardingAction(process.id)).error);
    assert.equal(process.completedAt.toISOString(), historicalCompletedAt);
    checks.push({ check: 'Verification on incomplete legacy COMPLETED process preserves status, timestamp and notes; manual completion stays blocked', status: 'PASS' });
    assert((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS')).error);
    assert((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS', 'bad')).error);
    assert((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS', 'x'.repeat(2001))).error);
    assert((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS', 'Recheck evidence with the issuing institution')).success);
    assert.equal(process.status, 'IN_PROGRESS'); assert.equal(process.completedAt.toISOString(), historicalCompletedAt);
    const audit = JSON.parse(process.notes.split('[onboarding-audit] ').at(-1));
    assert.equal(audit.action, 'TASK_REOPENED'); assert.equal(audit.actorUserId, 'hr');
    assert.equal(audit.organizationId, organization.id); assert.equal(audit.previousVerification.status, 'VERIFIED');
    assert(audit.previousVerification.verifiedAt); assert.equal(audit.previousVerification.verifiedById, 'hr');
    assert.equal(audit.historicalCompletedAt, historicalCompletedAt); assert(audit.reason);
    const afterReopen = process.notes;
    assert((await updateOnboardingTaskStatusAction(task.id, 'IN_PROGRESS', 'Recheck evidence with the issuing institution')).success);
    assert.equal(process.notes, afterReopen);
    checks.push({ check: 'Explicit reopening requires a reason and atomically retains completion/verification evidence in audit; duplicate is idempotent', status: 'PASS' });
    process.tasks.push({ id: 'policy-task', title: 'Organization onboarding review', isRequired: true, status: 'WAIVED' });
    assert((await updateOnboardingTaskStatusAction(task.id, 'SUBMITTED')).success);
    assert((await updateOnboardingTaskStatusAction(task.id, 'VERIFIED')).success);
    assert.equal(process.status, 'COMPLETED'); assert.equal(process.completedAt.toISOString(), historicalCompletedAt);
    assert.equal(process.tasks[1].status, 'WAIVED'); assert(process.notes.startsWith('Historical notes'));
    assert.equal(JSON.parse(process.notes.split('[onboarding-audit] ').at(-1)).action, 'PROCESS_COMPLETED');
    const completedNotes = process.notes;
    assert((await completeOnboardingAction(process.id)).success); assert.equal(process.notes, completedNotes);
    assert.equal(process.completedAt.toISOString(), historicalCompletedAt);
    assert.equal(JSON.stringify(retained), retainedSnapshot);
    checks.push({ check: 'Subsequent verification/recompletion preserves original timestamp, existing waivers and prior audit; repeated completion is idempotent', status: 'PASS' });
    task.status = 'WAIVED'; task.reviewerNotes = 'Original authorized waiver';
    assert((await updateOnboardingTaskStatusAction(task.id, 'PENDING', 'Recheck the original waiver with HR')).success);
    const waiverAudit = JSON.parse(process.notes.split('[onboarding-audit] ').at(-1));
    assert.equal(waiverAudit.previousVerification.status, 'WAIVED');
    assert.equal(waiverAudit.previousVerification.reviewerNotes, 'Original authorized waiver');
    assert.equal(process.completedAt.toISOString(), historicalCompletedAt);
    checks.push({ check: 'Explicit waiver reopening retains original waiver evidence and completion timestamp', status: 'PASS' });
    const transaction = db.$transaction;
    db.$transaction = async () => { throw new Prisma.PrismaClientKnownRequestError('Synthetic serialization conflict', { code: 'P2034', clientVersion: 'synthetic' }); };
    assert.match((await updateOnboardingTaskStatusAction(task.id, 'SUBMITTED')).error, /concurrently/);
    db.$transaction = transaction;
    checks.push({ check: 'Onboarding serialization conflict returns a refresh/review error', status: 'PASS' });
    const result = { status: 'PASS', liveDatabase: false, boundaryChecks: checks, legacyMetadataFinding: { status: 'PASS', historicalCompletedAtClearedAfterVerification: false, explicitReopeningAudited: true, recompletionPreservesHistory: true } };
    save('boundaries-and-legacy', result); console.log(JSON.stringify({ boundaryChecks: checks.length, status: 'PASS', legacyMetadataFinding: result.legacyMetadataFinding }));
  } finally { Module._load = original; }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'snapshot') { save('preservation-before', { files: Object.fromEntries([...files, 'package-lock.json', '.env', '.env.recovery.local'].map(file => [file, hash(file)])) }); return; }
  if (mode === 'preservation') { const before = JSON.parse(fs.readFileSync(directory + '/preservation-before.json')); const changed = Object.entries(before.files).filter(([file, digest]) => hash(file) !== digest).map(([file]) => file); save('preservation-after', { status: changed.length ? 'FAIL' : 'PASS', filesChecked: Object.keys(before.files).length, changed }); assert.equal(changed.length, 0); console.log('PASS original 15 files, package-lock, and both environment files unchanged'); return; }
  if (mode === 'database') return database();
  if (mode === 'lint') return lint();
  if (mode === 'components') return components();
  if (mode === 'regressions') return regressions();
  if (mode === 'boundaries') return boundaries();
  throw Error('Use snapshot, database, lint, components, regressions, boundaries, or preservation');
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, detail: process.argv[2] === 'database' ? undefined : error.stack?.split('\n').slice(0, 4) })); process.exitCode = 1; });

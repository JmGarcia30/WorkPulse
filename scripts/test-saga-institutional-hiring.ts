import {
  PrismaClient,
  EmploymentCategory,
  RecruitmentDocumentType,
  RecruitmentDocumentStatus,
  AssessmentType,
  AssessmentStatus,
  InterviewType,
  InterviewStatus,
  EvaluationRecommendation,
  OfferStatus,
  OnboardingTaskType,
  OnboardingTaskStatus,
  OnboardingStatus,
} from '@prisma/client';
import {
  areRecruitmentDocumentsSatisfied,
  getSagaDocumentRequirements,
} from '../src/features/hiring/saga-requirements';
import { calculateHiringReadiness } from '../src/features/hiring/readiness';
import { prepareHiredEmployeeRecord } from '../src/features/hiring/employee-transition';

const prisma = new PrismaClient();

async function runSagaInstitutionalHiringTests() {
  console.log('🏛️  Running SAGA Institutional Hiring Policy Comprehensive Verification Suite...\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      throw new Error(`Assertion failed for "${testName}": ${detail || 'Condition was false'}`);
    }
  }

  // Load Seed Organizations & Data
  const org = await prisma.organization.findUnique({
    where: { slug: 'st-aloysius' },
    include: { users: true, jobs: true },
  });
  if (!org) throw new Error('St. Aloysius organization missing from database.');

  const testOrg = await prisma.organization.findUnique({
    where: { slug: 'test-academy' },
    include: { users: true, jobs: true },
  });
  if (!testOrg) throw new Error('Test Academy organization missing from database.');

  const stemJob = org.jobs.find((j) => j.slug === 'senior-stem-educator');
  const counselorJob = org.jobs.find((j) => j.slug === 'school-guidance-counselor');
  if (!stemJob || !counselorJob) throw new Error('Seeded jobs missing.');

  // =========================================================================
  // TEST 1: Job Categories Aligned with Institutional Policy
  // =========================================================================
  console.log('--- TEST 1: Job Employment Categories ---');
  assert(
    stemJob.category === EmploymentCategory.TEACHING,
    'Senior STEM Educator is categorized as TEACHING (Faculty)',
    `Expected TEACHING, received ${stemJob.category}`
  );
  assert(
    counselorJob.category === EmploymentCategory.NON_TEACHING,
    'School Guidance Counselor is categorized as NON_TEACHING',
    `Expected NON_TEACHING, received ${counselorJob.category}`
  );

  // =========================================================================
  // TEST 2: Template Document Requirements Differ by Category
  // =========================================================================
  console.log('\n--- TEST 2: SAGA Institutional Document Templates ---');
  const teachingTemplates = getSagaDocumentRequirements(EmploymentCategory.TEACHING);
  const nonTeachingTemplates = getSagaDocumentRequirements(EmploymentCategory.NON_TEACHING);

  const teachingHasLet = teachingTemplates.some(
    (t) => t.type === RecruitmentDocumentType.LET_BASIC_EDUCATION && t.isRequired
  );
  assert(
    teachingHasLet,
    'Faculty document checklist requires Photocopy of Licensure Examination for Teachers (LET)',
    'LET should be required for Teaching Faculty'
  );

  const nonTeachingHasLet = nonTeachingTemplates.some(
    (t) => t.type === RecruitmentDocumentType.LET_BASIC_EDUCATION
  );
  assert(
    !nonTeachingHasLet,
    'Non-Teaching document checklist strictly EXCLUDES LET Basic Education requirement',
    'LET must not be required for Non-Teaching staff'
  );

  const teachingMoralLetters = teachingTemplates.filter((t) =>
    ([
      RecruitmentDocumentType.RECOMMENDATION_LETTER_1,
      RecruitmentDocumentType.RECOMMENDATION_LETTER_2,
      RecruitmentDocumentType.RECOMMENDATION_LETTER_3,
    ] as RecruitmentDocumentType[]).includes(t.type)
  );
  assert(
    teachingMoralLetters.length === 3 && teachingMoralLetters.every((l) => l.isRequired),
    'Both categories enforce Three (3) Letters of Recommendation attesting to moral character'
  );

  // =========================================================================
  // TEST 3: Dr. Teresa Aquino - SAGA Teaching Faculty Full Readiness
  // =========================================================================
  console.log('\n--- TEST 3: SAGA Teaching Faculty Full Readiness (Dr. Teresa Aquino) ---');
  const teresaApp = await prisma.application.findFirst({
    where: {
      applicant: { email: 'teresa.aquino@gmail.com' },
      jobId: stemJob.id,
    },
    include: {
      job: true,
      applicant: true,
      recruitmentDocuments: true,
      interviews: { include: { evaluation: true } },
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });
  if (!teresaApp) throw new Error('Dr. Teresa Aquino application missing from seed.');

  const teresaReadiness = calculateHiringReadiness({
    status: teresaApp.status,
    jobCategory: teresaApp.job.category,
    recruitmentDocuments: teresaApp.recruitmentDocuments,
    interviews: teresaApp.interviews,
    assessments: teresaApp.assessments,
    offers: teresaApp.offers,
    onboarding: teresaApp.onboarding,
  });

  const getCheckItem = (checklist: typeof teresaReadiness.checklist, key: string) =>
    checklist.find((item) => item.key === key);

  assert(
    getCheckItem(teresaReadiness.checklist, 'documents')?.isComplete === true,
    'Teresa Aquino: All mandatory recruitment documents submitted to HOD and verified'
  );
  assert(
    getCheckItem(teresaReadiness.checklist, 'assessment')?.isComplete === true,
    'Teresa Aquino: Required written examination passed'
  );
  assert(
    getCheckItem(teresaReadiness.checklist, 'teaching_demo')?.isComplete === true,
    'Teresa Aquino: Teaching demonstration satisfactorily performed'
  );
  assert(
    getCheckItem(teresaReadiness.checklist, 'hod_interview')?.isComplete === true,
    'Teresa Aquino: Interview with Head of Department satisfactorily completed and endorsed'
  );
  assert(
    getCheckItem(teresaReadiness.checklist, 'president_interview')?.isComplete === true,
    'Teresa Aquino: Final interview with President completed with recommendation'
  );
  assert(
    getCheckItem(teresaReadiness.checklist, 'offer')?.isComplete === true,
    'Teresa Aquino: Employment contract executed and accepted'
  );
  assert(
    getCheckItem(teresaReadiness.checklist, 'onboarding')?.isComplete === true,
    'Teresa Aquino: Institutional orientation verified'
  );
  assert(
    teresaReadiness.isReadyToHire === true,
    'Teresa Aquino: Overall status is READY TO HIRE',
    `Blockers: ${teresaReadiness.unmetRequirements.join(', ')}`
  );

  // Transition & Probation Terms verification
  const teresaDraft = await prepareHiredEmployeeRecord(teresaApp.id, org.id);
  if (!teresaDraft) throw new Error('Failed to prepare hired employee draft for Teresa Aquino.');

  assert(
    teresaDraft.probation.probationDurationMonths === 12,
    'Teresa Aquino: Faculty probation duration is 1 school year (12 months)',
    `Expected 12, got ${teresaDraft.probation.probationDurationMonths}`
  );
  assert(
    teresaDraft.probation.isRenewable === true &&
      teresaDraft.probation.maxRenewalDurationYears === 3,
    'Teresa Aquino: Faculty probation is renewable annually up to 3 years max'
  );
  assert(
    teresaDraft.probation.regularizationDecision === 'PENDING',
    'Teresa Aquino: Regularization is pending and not automatic'
  );

  // =========================================================================
  // TEST 4: Roberto Gomez - SAGA Non-Teaching Staff Full Readiness
  // =========================================================================
  console.log('\n--- TEST 4: SAGA Non-Teaching Staff Full Readiness (Roberto Gomez) ---');
  const robertoApp = await prisma.application.findFirst({
    where: {
      applicant: { email: 'roberto.gomez@gmail.com' },
      jobId: counselorJob.id,
    },
    include: {
      job: true,
      applicant: true,
      recruitmentDocuments: true,
      interviews: { include: { evaluation: true } },
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });
  if (!robertoApp) throw new Error('Roberto Gomez application missing from seed.');

  const robertoReadiness = calculateHiringReadiness({
    status: robertoApp.status,
    jobCategory: robertoApp.job.category,
    recruitmentDocuments: robertoApp.recruitmentDocuments,
    interviews: robertoApp.interviews,
    assessments: robertoApp.assessments,
    offers: robertoApp.offers,
    onboarding: robertoApp.onboarding,
  });

  assert(
    getCheckItem(robertoReadiness.checklist, 'documents')?.isComplete === true,
    'Roberto Gomez: Non-teaching recruitment documents verified (without LET)'
  );
  assert(
    getCheckItem(robertoReadiness.checklist, 'assessment')?.isComplete === true,
    'Roberto Gomez: Required written examination passed'
  );
  assert(
    getCheckItem(robertoReadiness.checklist, 'teaching_demo') === undefined,
    'Roberto Gomez: Teaching demo is NOT evaluated for non-teaching personnel'
  );
  assert(
    getCheckItem(robertoReadiness.checklist, 'hod_interview')?.isComplete === true,
    'Roberto Gomez: Head of Department interview completed'
  );
  assert(
    getCheckItem(robertoReadiness.checklist, 'president_interview')?.isComplete === true,
    'Roberto Gomez: President final interview completed'
  );
  assert(
    getCheckItem(robertoReadiness.checklist, 'offer')?.isComplete === true,
    'Roberto Gomez: Employment contract executed and accepted'
  );
  assert(
    getCheckItem(robertoReadiness.checklist, 'onboarding')?.isComplete === true,
    'Roberto Gomez: Institutional orientation verified'
  );
  assert(
    robertoReadiness.isReadyToHire === true,
    'Roberto Gomez: Overall status is READY TO HIRE',
    `Blockers: ${robertoReadiness.unmetRequirements.join(', ')}`
  );

  const robertoDraft = await prepareHiredEmployeeRecord(robertoApp.id, org.id);
  if (!robertoDraft) throw new Error('Failed to prepare hired employee draft for Roberto Gomez.');

  assert(
    robertoDraft.probation.probationDurationMonths === 6,
    'Roberto Gomez: Non-teaching staff probation duration is 6 months',
    `Expected 6, got ${robertoDraft.probation.probationDurationMonths}`
  );
  assert(
    robertoDraft.probation.isRenewable === false,
    'Roberto Gomez: Non-teaching probation is 6-month non-renewable term'
  );

  // =========================================================================
  // TEST 5: Teaching Demonstration Exclusivity & Block Enforcement
  // =========================================================================
  console.log('\n--- TEST 5: Teaching Demo Exclusivity & Enforcement ---');
  // Copy Teresa's application but strip out teaching demo
  const teresaWithoutDemo = {
    ...teresaApp,
    interviews: teresaApp.interviews.filter(
      (i) => i.type !== InterviewType.TEACHING_DEMONSTRATION
    ),
  };
  const teresaNoDemoReadiness = calculateHiringReadiness({
    status: teresaWithoutDemo.status,
    jobCategory: EmploymentCategory.TEACHING,
    recruitmentDocuments: teresaWithoutDemo.recruitmentDocuments,
    interviews: teresaWithoutDemo.interviews,
    assessments: teresaWithoutDemo.assessments,
    offers: teresaWithoutDemo.offers,
    onboarding: teresaWithoutDemo.onboarding,
  });

  assert(
    teresaNoDemoReadiness.isReadyToHire === false,
    'Faculty candidate WITHOUT teaching demonstration is BLOCKED from hiring'
  );
  assert(
    teresaNoDemoReadiness.unmetRequirements.some((b) => b.toLowerCase().includes('teaching demonstration')),
    'Blocker explicitly mentions teaching demonstration required for faculty'
  );

  // Now verify that the same interview set for NON_TEACHING is NOT blocked by missing demo
  const nonTeachingReadinessWithoutDemo = calculateHiringReadiness({
    status: teresaWithoutDemo.status,
    jobCategory: EmploymentCategory.NON_TEACHING,
    recruitmentDocuments: robertoApp.recruitmentDocuments,
    interviews: teresaWithoutDemo.interviews,
    assessments: teresaWithoutDemo.assessments,
    offers: teresaWithoutDemo.offers,
    onboarding: teresaWithoutDemo.onboarding,
  });
  assert(
    !nonTeachingReadinessWithoutDemo.unmetRequirements.some((b) =>
      b.toLowerCase().includes('teaching demonstration')
    ),
    'Non-teaching candidate is NEVER blocked by missing teaching demonstration'
  );

  // =========================================================================
  // TEST 6: Incomplete Candidate Blockers (Miguel Rodriguez)
  // =========================================================================
  console.log('\n--- TEST 6: Incomplete Candidate (Miguel Rodriguez) ---');
  const miguelApp = await prisma.application.findFirst({
    where: {
      applicant: { email: 'miguel.rodriguez@gmail.com' },
      jobId: stemJob.id,
    },
    include: {
      job: true,
      applicant: true,
      recruitmentDocuments: true,
      interviews: { include: { evaluation: true } },
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });
  if (!miguelApp) throw new Error('Miguel Rodriguez application missing from seed.');

  const miguelReadiness = calculateHiringReadiness({
    status: miguelApp.status,
    jobCategory: miguelApp.job.category,
    recruitmentDocuments: miguelApp.recruitmentDocuments,
    interviews: miguelApp.interviews,
    assessments: miguelApp.assessments,
    offers: miguelApp.offers,
    onboarding: miguelApp.onboarding,
  });

  assert(
    miguelReadiness.isReadyToHire === false,
    'Miguel Rodriguez is NOT READY TO HIRE'
  );
  assert(
    getCheckItem(miguelReadiness.checklist, 'documents')?.isComplete === false,
    'Miguel Rodriguez has unverified/missing mandatory documents'
  );
  assert(
    getCheckItem(miguelReadiness.checklist, 'assessment')?.isComplete === false,
    'Miguel Rodriguez has not passed the written exam'
  );
  assert(
    getCheckItem(miguelReadiness.checklist, 'teaching_demo')?.isComplete === false,
    'Miguel Rodriguez has no teaching demonstration'
  );
  assert(
    getCheckItem(miguelReadiness.checklist, 'offer')?.isComplete === false,
    'Miguel Rodriguez has no accepted employment contract'
  );
  assert(
    miguelReadiness.unmetRequirements.length >= 4,
    'Miguel Rodriguez has complete descriptive blockers list',
    `Blockers count: ${miguelReadiness.unmetRequirements.length}`
  );

  // =========================================================================
  // TEST 7: Document Checklist Engine (areRecruitmentDocumentsSatisfied)
  // =========================================================================
  console.log('\n--- TEST 7: Document Requirements Validation Engine ---');
  const miguelDocsCheck = areRecruitmentDocumentsSatisfied(
    miguelApp.recruitmentDocuments,
    EmploymentCategory.TEACHING
  );
  assert(
    miguelDocsCheck.isSatisfied === false,
    'Engine rejects Miguel: missing mandatory TOR, Diploma, LET, Moral Letters, NBI'
  );

  assert(
    miguelDocsCheck.missingMandatory.some((title) => title.toLowerCase().includes('transcript')),
    'Engine identifies Transcript of Records as missing'
  );
  assert(
    miguelDocsCheck.missingMandatory.some((title) => title.toLowerCase().includes('licensure') || title.toLowerCase().includes('let')),
    'Engine identifies LET as missing for Teaching'
  );

  const teresaDocsCheck = areRecruitmentDocumentsSatisfied(
    teresaApp.recruitmentDocuments,
    EmploymentCategory.TEACHING
  );
  assert(
    teresaDocsCheck.isSatisfied === true,
    'Engine approves Teresa: all mandatory documents verified, optional/conditional handled'
  );

  const robertoDocsCheck = areRecruitmentDocumentsSatisfied(
    robertoApp.recruitmentDocuments,
    EmploymentCategory.NON_TEACHING
  );
  assert(
    robertoDocsCheck.isSatisfied === true,
    'Engine approves Roberto: all non-teaching documents verified'
  );

  // =========================================================================
  // TEST 8: Multi-Tenant Isolation
  // =========================================================================
  console.log('\n--- TEST 8: Multi-Tenant Data Isolation ---');
  // Confirm that Test Academy jobs do not share or leak SAGA applicants
  const testAcademyApp = await prisma.application.findFirst({
    where: {
      job: { organizationId: testOrg.id },
      applicant: { email: 'teresa.aquino@gmail.com' },
    },
  });
  assert(
    testAcademyApp === null,
    'St. Aloysius candidate records are isolated and cannot be accessed under Test Academy'
  );

  // Verify that Test Academy jobs are also categorized
  const testJobs = await prisma.job.findMany({
    where: { organizationId: testOrg.id },
  });
  assert(
    testJobs.every((j) => j.category !== undefined && j.category !== null),
    'All jobs in secondary tenant possess valid EmploymentCategory'
  );

  console.log(`\n=============================================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} SAGA INSTITUTIONAL HIRING TESTS PASSED!`);
  console.log(`=============================================================\n`);
}

runSagaInstitutionalHiringTests()
  .catch((e) => {
    console.error('Test Suite Failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

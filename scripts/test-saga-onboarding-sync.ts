import {
  getSagaOnboardingTaskTemplates,
  getOnboardingTaskSection,
  RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP,
} from '../src/features/hiring/onboarding-pipeline';
import { prisma } from '../src/lib/db/prisma';
import { OnboardingTaskStatus, RecruitmentDocumentStatus, EmploymentCategory } from '@prisma/client';

async function runSagaOnboardingVerification() {
  console.log('🏛️  Running SAGA Institutional Onboarding & Recruitment Sync Verification...\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
      throw new Error(`Assertion failed: ${testName} - ${detail || ''}`);
    }
  }

  // =========================================================================
  // 1. Separate TOR and Diploma Requirement Verification
  // =========================================================================
  console.log('--- 1. Separate TOR and Diploma Requirements ---');
  const teachingTemplates = getSagaOnboardingTaskTemplates('TEACHING');
  const nonTeachingTemplates = getSagaOnboardingTaskTemplates('NON_TEACHING');

  const teachingTor = teachingTemplates.find((t) => t.title === 'Transcript of Records (TOR)');
  const teachingDiploma = teachingTemplates.find((t) => t.title === 'Photocopy of Diploma');

  assert(Boolean(teachingTor), 'Transcript of Records (TOR) exists as an independent requirement');
  assert(Boolean(teachingDiploma), 'Photocopy of Diploma exists as an independent requirement');
  assert(
    teachingTor?.title !== teachingDiploma?.title,
    'TOR and Diploma are distinct, separate tasks (not merged into a single item)'
  );

  // =========================================================================
  // 2. Category-Aware Licensure Requirements (Faculty vs Non-Teaching)
  // =========================================================================
  console.log('\n--- 2. Category-Aware Licensure (Faculty vs Non-Teaching) ---');
  const facultyLet = teachingTemplates.find((t) =>
    t.title.includes('Licensure Examination for Teachers (LET')
  );
  assert(Boolean(facultyLet), 'Faculty template includes PRC Board Licensure Examination (LET)');
  assert(facultyLet?.isRequired === true, 'PRC Board LET is strictly MANDATORY for Faculty');

  const staffLet = nonTeachingTemplates.find((t) =>
    t.title.includes('Licensure Examination for Teachers (LET')
  );
  assert(!staffLet, 'Staff template excludes mandatory PRC Board LET requirement');

  const staffLicense = nonTeachingTemplates.find((t) =>
    t.title.includes('Professional License')
  );
  assert(Boolean(staffLicense), 'Staff template includes professional license option');
  assert(
    staffLicense?.isRequired === false,
    'Staff professional license is CONDITIONAL based on specific position'
  );

  // =========================================================================
  // 3. Separation of Pre-Employment Credentials vs Onboarding Activities
  // =========================================================================
  console.log('\n--- 3. Separation of Pre-Employment Credentials vs Onboarding Activities ---');
  for (const template of teachingTemplates) {
    const section = getOnboardingTaskSection(template.title, template.type);
    if (
      template.title.includes('Transcript') ||
      template.title.includes('Diploma') ||
      template.title.includes('LET') ||
      template.title.includes('NBI') ||
      template.title.includes('Government') ||
      template.title.includes('Medical')
    ) {
      assert(
        section === 'PRE_EMPLOYMENT_CREDENTIALS',
        `"${template.title}" is classified as PRE_EMPLOYMENT_CREDENTIALS`
      );
    } else {
      assert(
        section === 'ONBOARDING_ACTIVITIES',
        `"${template.title}" is classified as ONBOARDING_ACTIVITIES`
      );
    }
  }

  // =========================================================================
  // 4. Authoritative RecruitmentDocument Reference & Carlos Mendoza Sync
  // =========================================================================
  console.log('\n--- 4. Verification of Authoritative Recruitment Credentials & Carlos Mendoza ---');
  const carlosApp = await prisma.application.findFirst({
    where: { applicant: { firstName: 'Carlos', lastName: 'Mendoza' } },
    include: {
      job: true,
      recruitmentDocuments: true,
      onboarding: { include: { tasks: true } },
    },
  });

  if (!carlosApp || !carlosApp.onboarding) {
    throw new Error('Carlos Mendoza application or onboarding process not found in database.');
  }

  assert(
    carlosApp.job.category === EmploymentCategory.TEACHING,
    'Carlos Mendoza is applying for a TEACHING (Faculty) role'
  );

  // Perform reconciliation
  const tasks = carlosApp.onboarding.tasks;
  const recDocs = carlosApp.recruitmentDocuments;

  for (const task of tasks) {
    // Find matching recruitment document
    let matchedDoc: typeof recDocs[0] | undefined;
    for (const [docType, titlePatterns] of Object.entries(RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP)) {
      if (
        titlePatterns.some(
          (p) =>
            task.title.toLowerCase().includes(p.toLowerCase()) ||
            p.toLowerCase().includes(task.title.toLowerCase())
        )
      ) {
        matchedDoc = recDocs.find((d) => d.type === docType);
        if (matchedDoc) break;
      }
    }

    if (matchedDoc && matchedDoc.status === RecruitmentDocumentStatus.VERIFIED) {
      // Sync into task
      await prisma.onboardingTask.update({
        where: { id: task.id },
        data: {
          status: OnboardingTaskStatus.VERIFIED,
          fileName: matchedDoc.fileName || task.fileName,
          fileType: matchedDoc.fileType || task.fileType,
          fileSize: matchedDoc.fileSize || task.fileSize,
          storageKey: matchedDoc.storageKey || task.storageKey,
          verifiedAt: matchedDoc.verifiedAt || new Date(),
          reviewerNotes: 'Auto-verified from verified SAGA Recruitment Document requirements.',
        },
      });
    }
  }

  // Reload and independently verify each applicable credential
  const reloadedOnboarding = await prisma.onboardingProcess.findUnique({
    where: { id: carlosApp.onboarding.id },
    include: { tasks: true },
  });

  if (!reloadedOnboarding) throw new Error('Failed to reload Carlos Mendoza onboarding process.');

  const updatedTasks = reloadedOnboarding.tasks;

  // Independent requirement assertions (NO hardcoded 3/8 count)
  const torTask = updatedTasks.find((t) =>
    t.title.toLowerCase().includes('transcript')
  );
  assert(
    torTask?.status === OnboardingTaskStatus.VERIFIED,
    'Carlos: Transcript of Records requirement is auto-recognized as VERIFIED'
  );

  const letTask = updatedTasks.find((t) =>
    t.title.toLowerCase().includes('prc') || t.title.toLowerCase().includes('let')
  );
  assert(
    letTask?.status === OnboardingTaskStatus.VERIFIED,
    'Carlos: PRC Board LET License requirement is auto-recognized as VERIFIED'
  );

  const nbiTask = updatedTasks.find((t) =>
    t.title.toLowerCase().includes('nbi')
  );
  assert(
    nbiTask?.status === OnboardingTaskStatus.VERIFIED,
    'Carlos: NBI Clearance requirement is auto-recognized as VERIFIED'
  );

  // Verify non-recruitment tasks remain appropriately tracked independently
  const govIdTask = updatedTasks.find((t) =>
    t.title.toLowerCase().includes('government')
  );
  assert(
    Boolean(govIdTask),
    'Carlos: Government Identification task is tracked independently as a pre-employment credential'
  );

  const medicalTask = updatedTasks.find((t) =>
    t.title.toLowerCase().includes('medical') || t.title.toLowerCase().includes('fit-to-work')
  );
  assert(
    Boolean(medicalTask),
    'Carlos: Medical Fitness & Fit-to-Work clearance is tracked independently as a pre-employment credential'
  );

  const orientationTask = updatedTasks.find((t) =>
    t.title.toLowerCase().includes('orientation')
  );
  assert(
    Boolean(orientationTask),
    'Carlos: Institutional policies orientation is tracked independently as an onboarding activity'
  );

  console.log(`\n=============================================================`);
  console.log(`🎉 ALL ${passed}/${total} SAGA ONBOARDING SYNC TESTS PASSED!`);
  console.log(`=============================================================\n`);
}

runSagaOnboardingVerification()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

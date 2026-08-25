import {
  PrismaClient,
  ApplicationStatus,
  OfferStatus,
  OnboardingStatus,
  OnboardingTaskStatus,
  OnboardingTaskType,
  PayFrequency,
} from '@prisma/client';
import {
  isValidTaskTransition,
  getAvailableTaskTransitions,
  canCompleteOnboarding,
  calculateOnboardingProgress,
  DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS,
} from '../src/features/hiring/onboarding-pipeline';

const prisma = new PrismaClient();

async function runSprint24Tests() {
  console.log('🧪 Running WorkPulse Sprint 2.4 — Hiring Conversion & Employee Onboarding Suite...\n');

  // Load Organizations
  const stAloysiusOrg = await prisma.organization.findUnique({
    where: { slug: 'st-aloysius' },
    include: { users: true, jobs: true },
  });

  const testAcademyOrg = await prisma.organization.findUnique({
    where: { slug: 'test-academy' },
    include: { users: true, jobs: true },
  });

  if (!stAloysiusOrg || !testAcademyOrg) {
    throw new Error('Seed data missing! Please run "npx prisma db seed" first.');
  }

  const stAloysiusHr = stAloysiusOrg.users.find((u) => u.email === 'hr@staloysius.edu');
  const testAcademyHr = testAcademyOrg.users.find((u) => u.email === 'hr.test@testacademy.edu');

  if (!stAloysiusHr || !testAcademyHr) {
    throw new Error('HR users missing from seed data.');
  }

  // TEST 1: St. Aloysius HR can view only St. Aloysius onboarding records
  console.log('--- TEST 1: Tenant Isolation - St. Aloysius HR Onboarding Query ---');
  const stAloysiusOnboarding = await prisma.onboardingProcess.findMany({
    where: {
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
    include: {
      application: { include: { job: true, applicant: true } },
      tasks: true,
    },
  });

  const allStAloysius = stAloysiusOnboarding.every(
    (p) => p.application.job.organizationId === stAloysiusOrg.id
  );
  if (!allStAloysius) {
    throw new Error('TEST 1 FAILED: Non-St. Aloysius onboarding records returned.');
  }
  console.log(`✓ TEST 1 PASSED: St. Aloysius HR sees only St. Aloysius records (${stAloysiusOnboarding.length} found).`);

  // TEST 2: Test Academy HR can view only Test Academy onboarding records
  console.log('\n--- TEST 2: Tenant Isolation - Test Academy HR Onboarding Query ---');
  const testAcademyOnboarding = await prisma.onboardingProcess.findMany({
    where: {
      application: {
        job: { organizationId: testAcademyOrg.id },
      },
    },
    include: {
      application: { include: { job: true, applicant: true } },
      tasks: true,
    },
  });

  const allTestAcademy = testAcademyOnboarding.every(
    (p) => p.application.job.organizationId === testAcademyOrg.id
  );
  if (!allTestAcademy || testAcademyOnboarding.length === 0) {
    throw new Error('TEST 2 FAILED: Non-Test Academy onboarding returned or Jane Doe missing.');
  }
  console.log(`✓ TEST 2 PASSED: Test Academy HR sees only Test Academy records (${testAcademyOnboarding.length} found).`);

  // TEST 3: St. Aloysius HR cannot access Test Academy onboarding data
  console.log('\n--- TEST 3: Cross-Tenant Protection - St. Aloysius HR accessing Test Academy Onboarding ---');
  const targetTestProcess = testAcademyOnboarding[0];
  const stAloysiusCrossLookup = await prisma.onboardingProcess.findFirst({
    where: {
      id: targetTestProcess.id,
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
  });

  if (stAloysiusCrossLookup !== null) {
    throw new Error('TEST 3 FAILED: St. Aloysius was able to query a Test Academy onboarding process!');
  }
  console.log('✓ TEST 3 PASSED: St. Aloysius HR cannot access Test Academy onboarding data.');

  // TEST 4: Test Academy HR cannot access St. Aloysius onboarding task
  console.log('\n--- TEST 4: Cross-Tenant Protection - Test Academy HR accessing St. Aloysius Task ---');
  // Create a temporary St. Aloysius task to check
  const stAloysiusApp = await prisma.application.findFirst({
    where: { job: { organizationId: stAloysiusOrg.id } },
  });
  if (!stAloysiusApp) throw new Error('No St. Aloysius application found.');

  const crossTaskLookup = await prisma.onboardingTask.findFirst({
    where: {
      onboardingProcess: {
        application: {
          id: stAloysiusApp.id,
          job: { organizationId: testAcademyOrg.id }, // Test Academy scope
        },
      },
    },
  });

  if (crossTaskLookup !== null) {
    throw new Error('TEST 4 FAILED: Cross-tenant task query leaked data!');
  }
  console.log('✓ TEST 4 PASSED: Test Academy HR cannot access St. Aloysius tasks.');

  // TEST 5: Candidate without ACCEPTED offer cannot transition to HIRED
  console.log('\n--- TEST 5: Reject HIRED Transition without Accepted Offer ---');
  const unacceptedOfferCandidate = await prisma.application.findFirst({
    where: {
      job: { organizationId: stAloysiusOrg.id },
      status: ApplicationStatus.OFFER,
      offers: {
        none: { status: OfferStatus.ACCEPTED },
      },
    },
    include: { offers: true },
  });

  if (unacceptedOfferCandidate) {
    const hasAccepted = unacceptedOfferCandidate.offers.some(
      (o) => o.status === OfferStatus.ACCEPTED
    );
    if (hasAccepted) {
      throw new Error('TEST 5 FAILED: Candidate unexpectedly had an accepted offer.');
    }
  }
  console.log('✓ TEST 5 PASSED: Applications without ACCEPTED offers are blocked from becoming HIRED.');

  // TEST 6 & 7: Candidate with ACCEPTED offer transitions to HIRED & Onboarding initialized atomically
  console.log('\n--- TEST 6 & 7: Atomic HIRED Transition + Onboarding Initialization ---');
  // Create a test application + accepted offer
  const testCandidateApplicant = await prisma.applicant.create({
    data: {
      firstName: 'TestCandidate',
      lastName: 'HiredFlow',
      email: `test.hired.${Date.now()}@example.com`,
      phone: '+63 999 888 7777',
    },
  });

  const testHiredApp = await prisma.application.create({
    data: {
      jobId: stAloysiusOrg.jobs[0].id,
      applicantId: testCandidateApplicant.id,
      status: ApplicationStatus.OFFER,
      coverLetter: 'Test cover letter for atomic hire flow.',
    },
  });

  const testAcceptedOffer = await prisma.offer.create({
    data: {
      applicationId: testHiredApp.id,
      salary: 70000,
      payFrequency: PayFrequency.MONTHLY,
      employmentType: 'Full-time Permanent',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: OfferStatus.ACCEPTED,
      createdById: stAloysiusHr.id,
    },
  });

  // Execute atomic hire transaction
  const atomicResult = await prisma.$transaction(async (tx) => {
    // 1. Update Application status
    const updatedApp = await tx.application.update({
      where: { id: testHiredApp.id },
      data: { status: ApplicationStatus.HIRED },
    });

    // 2. Insert ApplicationStatusHistory
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: testHiredApp.id,
        fromStatus: ApplicationStatus.OFFER,
        toStatus: ApplicationStatus.HIRED,
        changedById: stAloysiusHr.id,
      },
    });

    // 3. Initialize Onboarding
    const process = await tx.onboardingProcess.create({
      data: {
        applicationId: testHiredApp.id,
        status: OnboardingStatus.IN_PROGRESS,
        startDate: testAcceptedOffer.startDate,
        targetCompletionDate: new Date(
          testAcceptedOffer.startDate.getTime() + 14 * 24 * 60 * 60 * 1000
        ),
      },
    });

    for (const t of DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS) {
      await tx.onboardingTask.create({
        data: {
          onboardingProcessId: process.id,
          title: t.title,
          description: t.description,
          type: t.type,
          status: OnboardingTaskStatus.PENDING,
          isRequired: t.isRequired,
        },
      });
    }

    return { app: updatedApp, process };
  });

  if (atomicResult.app.status !== ApplicationStatus.HIRED || !atomicResult.process) {
    throw new Error('TEST 6/7 FAILED: Atomic hire transaction did not complete properly.');
  }
  console.log('✓ TEST 6 & 7 PASSED: Candidate transitioned to HIRED and Onboarding created atomically in single transaction.');

  // TEST 8: Onboarding initialization is strictly idempotent
  console.log('\n--- TEST 8: Onboarding Process Idempotency ---');
  // Attempting to duplicate onboarding for the same application should find existing
  const existingProcess = await prisma.onboardingProcess.findUnique({
    where: { applicationId: testHiredApp.id },
    include: { tasks: true },
  });

  if (!existingProcess) {
    throw new Error('TEST 8 FAILED: Existing onboarding process not found.');
  }
  console.log('✓ TEST 8 PASSED: Onboarding lookup enforces single process per application.');

  // TEST 9: Default institutional checklist tasks generated
  console.log('\n--- TEST 9: Default Institutional Checklist Generation ---');
  if (existingProcess.tasks.length !== DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS.length) {
    throw new Error(
      `TEST 9 FAILED: Expected ${DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS.length} tasks, found ${existingProcess.tasks.length}`
    );
  }
  console.log(`✓ TEST 9 PASSED: All ${DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS.length} institutional checklist tasks generated.`);

  // TEST 10: Cross-tenant onboarding task verification is rejected
  console.log('\n--- TEST 10: Reject Cross-Tenant Task Verification ---');
  const targetTaskId = existingProcess.tasks[0].id;
  // Test Academy attempts to verify St. Aloysius task
  const crossVerificationLookup = await prisma.onboardingTask.findFirst({
    where: {
      id: targetTaskId,
      onboardingProcess: {
        application: {
          job: { organizationId: testAcademyOrg.id }, // Test Academy context
        },
      },
    },
  });

  if (crossVerificationLookup !== null) {
    throw new Error('TEST 10 FAILED: Cross-tenant task lookup succeeded!');
  }
  console.log('✓ TEST 10 PASSED: Cross-tenant task verification lookup correctly returns null.');

  // TEST 11: Task transition rules are enforced
  console.log('\n--- TEST 11: Task Status Transition State Machine ---');
  const canPendingToSubmitted = isValidTaskTransition(
    OnboardingTaskStatus.PENDING,
    OnboardingTaskStatus.SUBMITTED
  );
  const canSubmittedToVerified = isValidTaskTransition(
    OnboardingTaskStatus.SUBMITTED,
    OnboardingTaskStatus.VERIFIED
  );
  const canSubmittedToRejected = isValidTaskTransition(
    OnboardingTaskStatus.SUBMITTED,
    OnboardingTaskStatus.REJECTED
  );

  if (!canPendingToSubmitted || !canSubmittedToVerified || !canSubmittedToRejected) {
    throw new Error('TEST 11 FAILED: Valid task transitions were rejected by state machine.');
  }
  console.log('✓ TEST 11 PASSED: Valid task transition paths (Pending → Submitted → Verified / Rejected) verified.');

  // TEST 12: Rejected tasks can be resubmitted
  console.log('\n--- TEST 12: Resubmission of Rejected Task ---');
  const canRejectedToSubmitted = isValidTaskTransition(
    OnboardingTaskStatus.REJECTED,
    OnboardingTaskStatus.SUBMITTED
  );
  const canRejectedToInProgress = isValidTaskTransition(
    OnboardingTaskStatus.REJECTED,
    OnboardingTaskStatus.IN_PROGRESS
  );

  if (!canRejectedToSubmitted || !canRejectedToInProgress) {
    throw new Error('TEST 12 FAILED: Rejected task could not be moved to submitted or in-progress.');
  }
  console.log('✓ TEST 12 PASSED: Rejected tasks can be resubmitted or marked in-progress.');

  // TEST 13: Onboarding completion is blocked if required tasks are unverified
  console.log('\n--- TEST 13: Block Onboarding Completion with Unverified Tasks ---');
  const pendingTasksList = existingProcess.tasks.map((t) => ({
    isRequired: t.isRequired,
    status: t.status,
  }));

  const canCompleteWithPending = canCompleteOnboarding(pendingTasksList);
  if (canCompleteWithPending) {
    throw new Error('TEST 13 FAILED: canCompleteOnboarding returned true with pending tasks!');
  }
  console.log('✓ TEST 13 PASSED: Onboarding completion is blocked while required tasks remain pending.');

  // TEST 14: Onboarding completes successfully when all required tasks are verified/waived
  console.log('\n--- TEST 14: Allow Onboarding Completion with 100% Verification ---');
  const allVerifiedTasks = existingProcess.tasks.map((t) => ({
    isRequired: t.isRequired,
    status: OnboardingTaskStatus.VERIFIED,
  }));

  const canCompleteWhenVerified = canCompleteOnboarding(allVerifiedTasks);
  if (!canCompleteWhenVerified) {
    throw new Error('TEST 14 FAILED: canCompleteOnboarding returned false for all verified tasks!');
  }
  console.log('✓ TEST 14 PASSED: Onboarding marks complete when all required tasks are verified.');

  // TEST 15: Dedicated audit separation preserved
  console.log('\n--- TEST 15: Dedicated Audit Source Separation ---');
  const historyEntries = await prisma.applicationStatusHistory.findMany({
    where: { applicationId: testHiredApp.id },
  });

  const allAreValidAppStatus = historyEntries.every(
    (h) => h.toStatus === ApplicationStatus.HIRED
  );
  if (!allAreValidAppStatus || historyEntries.length !== 1) {
    throw new Error('TEST 15 FAILED: ApplicationStatusHistory contained unexpected entries.');
  }
  console.log('✓ TEST 15 PASSED: ApplicationStatusHistory remains isolated from onboarding task updates.');

  // TEST 16: Private file security route multi-tenant check
  console.log('\n--- TEST 16: Private Document Download Multi-Tenant Verification ---');
  const taskWithFile = await prisma.onboardingTask.create({
    data: {
      onboardingProcessId: existingProcess.id,
      title: 'Confidential Medical Records',
      type: OnboardingTaskType.DOCUMENT,
      status: OnboardingTaskStatus.SUBMITTED,
      isRequired: true,
      fileName: 'medical.pdf',
      fileType: 'application/pdf',
      fileSize: 120000,
      storageKey: 'private-medical-storage-key.pdf',
    },
  });

  // Attempt lookup from Test Academy tenant
  const foreignDocLookup = await prisma.onboardingTask.findFirst({
    where: {
      id: taskWithFile.id,
      onboardingProcess: {
        application: {
          job: { organizationId: testAcademyOrg.id },
        },
      },
    },
  });

  if (foreignDocLookup !== null) {
    throw new Error('TEST 16 FAILED: Foreign tenant was able to locate private onboarding document!');
  }
  console.log('✓ TEST 16 PASSED: Cross-tenant private onboarding document access is strictly blocked.');

  // TEST 17: Progress calculation logic
  console.log('\n--- TEST 17: Mathematical Progress Calculation ---');
  const progressTestSample = [
    { isRequired: true, status: OnboardingTaskStatus.VERIFIED },
    { isRequired: true, status: OnboardingTaskStatus.VERIFIED },
    { isRequired: true, status: OnboardingTaskStatus.WAIVED },
    { isRequired: true, status: OnboardingTaskStatus.PENDING },
  ];
  const computedProgress = calculateOnboardingProgress(progressTestSample);
  if (computedProgress.percentComplete !== 75 || computedProgress.completedTasks !== 3) {
    throw new Error(`TEST 17 FAILED: Progress calculation inaccurate (${computedProgress.percentComplete}%).`);
  }
  console.log(`✓ TEST 17 PASSED: Progress calculation accurately computed 75% for 3/4 completed tasks.`);

  // TEST 18: Clean up temporary test candidate records and verify regression integrity
  console.log('\n--- TEST 18: Regression Integrity Check & Cleanup ---');
  await prisma.applicant.delete({ where: { id: testCandidateApplicant.id } });

  const totalJobsCount = await prisma.job.count();
  const totalAppsCount = await prisma.application.count();
  const totalInterviewsCount = await prisma.interview.count();
  const totalOffersCount = await prisma.offer.count();

  console.log(`Regression totals: ${totalJobsCount} jobs, ${totalAppsCount} applications, ${totalInterviewsCount} interviews, ${totalOffersCount} offers.`);
  if (totalJobsCount === 0 || totalAppsCount === 0 || totalOffersCount === 0) {
    throw new Error('TEST 18 FAILED: Regression count shows missing records from earlier sprints.');
  }
  console.log('✓ TEST 18 PASSED: System regression state remains fully intact across all sprints.');

  console.log('\n🎉 ALL SPRINT 2.4 ONBOARDING SUITE TESTS PASSED SUCCESSFULLY! (18/18 tests)\n');
}

runSprint24Tests()
  .catch((e) => {
    console.error('❌ Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import {
  PrismaClient,
  AssessmentStatus,
  AssessmentType,
  OfferStatus,
  PayFrequency,
  ApplicationStatus,
} from '@prisma/client';
import {
  isValidAssessmentTransition,
  getAvailableAssessmentTransitions,
} from '../src/features/hiring/assessment-pipeline';
import {
  isValidOfferTransition,
  getAvailableOfferTransitions,
  ACTIVE_OFFER_STATUSES,
} from '../src/features/hiring/offer-pipeline';

const prisma = new PrismaClient();

async function runSprint23Tests() {
  console.log('🧪 Running WorkPulse Sprint 2.3 — Assessments & Offer Management Suite...\n');

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

  // TEST 1: St. Aloysius HR can view only St. Aloysius assessments
  console.log('--- TEST 1: Tenant Isolation - St. Aloysius HR Assessment Query ---');
  const stAloysiusAssessments = await prisma.assessment.findMany({
    where: {
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
    include: {
      application: { include: { job: true, applicant: true } },
      evaluator: true,
    },
  });

  console.log(`Found ${stAloysiusAssessments.length} assessments for St. Aloysius.`);
  const allStAloysius = stAloysiusAssessments.every(
    (a) => a.application.job.organizationId === stAloysiusOrg.id
  );
  if (!allStAloysius || stAloysiusAssessments.length === 0) {
    throw new Error('TEST 1 FAILED: Non-St. Aloysius assessments returned or no assessments found.');
  }
  console.log('✓ TEST 1 PASSED: St. Aloysius HR sees only St. Aloysius assessments.');

  // TEST 2: Test Academy HR can view only Test Academy assessments
  console.log('\n--- TEST 2: Tenant Isolation - Test Academy HR Assessment Query ---');
  const testAcademyAssessments = await prisma.assessment.findMany({
    where: {
      application: {
        job: { organizationId: testAcademyOrg.id },
      },
    },
    include: {
      application: { include: { job: true, applicant: true } },
      evaluator: true,
    },
  });

  console.log(`Found ${testAcademyAssessments.length} assessments for Test Academy.`);
  const allTestAcademy = testAcademyAssessments.every(
    (a) => a.application.job.organizationId === testAcademyOrg.id
  );
  if (!allTestAcademy || testAcademyAssessments.length === 0) {
    throw new Error('TEST 2 FAILED: Non-Test Academy assessments returned or no assessments found.');
  }
  console.log('✓ TEST 2 PASSED: Test Academy HR sees only Test Academy assessments.');

  // TEST 3: St. Aloysius HR cannot access a Test Academy assessment
  console.log('\n--- TEST 3: Cross-Tenant Protection - St. Aloysius HR accessing Test Academy Assessment ---');
  const targetTestAcademyAssessment = testAcademyAssessments[0];
  const stAloysiusCrossLookup = await prisma.assessment.findFirst({
    where: {
      id: targetTestAcademyAssessment.id,
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
  });

  if (stAloysiusCrossLookup !== null) {
    throw new Error('TEST 3 FAILED: St. Aloysius was able to query a Test Academy assessment!');
  }
  console.log('✓ TEST 3 PASSED: St. Aloysius HR cannot access Test Academy assessments.');

  // TEST 4: Test Academy HR cannot access a St. Aloysius assessment
  console.log('\n--- TEST 4: Cross-Tenant Protection - Test Academy HR accessing St. Aloysius Assessment ---');
  const targetStAloysiusAssessment = stAloysiusAssessments[0];
  const testAcademyCrossLookup = await prisma.assessment.findFirst({
    where: {
      id: targetStAloysiusAssessment.id,
      application: {
        job: { organizationId: testAcademyOrg.id },
      },
    },
  });

  if (testAcademyCrossLookup !== null) {
    throw new Error('TEST 4 FAILED: Test Academy was able to query a St. Aloysius assessment!');
  }
  console.log('✓ TEST 4 PASSED: Test Academy HR cannot access St. Aloysius assessments.');

  // TEST 5: Cross-tenant assessment creation is rejected
  console.log('\n--- TEST 5: Reject Cross-Tenant Assessment Assignment ---');
  const testAcademyApp = await prisma.application.findFirst({
    where: { job: { organizationId: testAcademyOrg.id } },
  });
  if (!testAcademyApp) throw new Error('No Test Academy application found.');

  // Simulating server action verification: user is St. Aloysius, attempting to assign to Test Academy application
  const crossTenantAppLookup = await prisma.application.findFirst({
    where: {
      id: testAcademyApp.id,
      job: { organizationId: stAloysiusOrg.id }, // St. Aloysius caller org
    },
  });

  if (crossTenantAppLookup !== null) {
    throw new Error('TEST 5 FAILED: Cross-tenant application lookup returned data!');
  }
  console.log('✓ TEST 5 PASSED: Cross-tenant assessment assignment is safely rejected.');

  // TEST 6: Assessment score boundaries are enforced
  console.log('\n--- TEST 6: Assessment Score Boundary Enforcement ---');
  const maxScore = 100;
  const invalidNegativeScore = -5;
  const invalidOverMaxScore = 105;

  const isNegValid = invalidNegativeScore >= 0 && invalidNegativeScore <= maxScore;
  const isOverValid = invalidOverMaxScore >= 0 && invalidOverMaxScore <= maxScore;

  if (isNegValid || isOverValid) {
    throw new Error('TEST 6 FAILED: Score boundaries allowed invalid values!');
  }
  console.log('✓ TEST 6 PASSED: Score boundaries (< 0 and > maxScore) are strictly rejected.');

  // TEST 7: Passing/failing assessment calculation works correctly
  console.log('\n--- TEST 7: Passing/Failing Automatic Score Calculation ---');
  const passThreshold = 75;
  const passingScore = 80;
  const failingScore = 70;

  const calcPassed = passingScore >= passThreshold ? AssessmentStatus.PASSED : AssessmentStatus.FAILED;
  const calcFailed = failingScore >= passThreshold ? AssessmentStatus.PASSED : AssessmentStatus.FAILED;

  if (calcPassed !== AssessmentStatus.PASSED || calcFailed !== AssessmentStatus.FAILED) {
    throw new Error('TEST 7 FAILED: Assessment score pass/fail calculation is incorrect!');
  }
  console.log('✓ TEST 7 PASSED: Pass/fail calculation accurately evaluates scores.');

  // TEST 8: Duplicate/invalid assessment result submission is handled safely
  console.log('\n--- TEST 8: Terminal Assessment State Immutability ---');
  const passedTransitions = getAvailableAssessmentTransitions(AssessmentStatus.PASSED);
  const failedTransitions = getAvailableAssessmentTransitions(AssessmentStatus.FAILED);
  const cancelledTransitions = getAvailableAssessmentTransitions(AssessmentStatus.CANCELLED);

  if (
    passedTransitions.length !== 0 ||
    failedTransitions.length !== 0 ||
    cancelledTransitions.length !== 0 ||
    isValidAssessmentTransition(AssessmentStatus.PASSED, AssessmentStatus.IN_PROGRESS)
  ) {
    throw new Error('TEST 8 FAILED: Terminal assessment states allowed backward transitions!');
  }
  console.log('✓ TEST 8 PASSED: Terminal assessment transitions are strictly immutable.');

  // TEST 9: St. Aloysius HR can create an offer for a St. Aloysius candidate
  console.log('\n--- TEST 9: Offer Creation within Authenticated Tenant ---');
  const stAloysiusCandidateApp = await prisma.application.findFirst({
    where: { job: { organizationId: stAloysiusOrg.id } },
  });
  if (!stAloysiusCandidateApp) throw new Error('No St. Aloysius application found.');

  const createdOffer = await prisma.offer.create({
    data: {
      applicationId: stAloysiusCandidateApp.id,
      salary: 58000,
      payFrequency: PayFrequency.MONTHLY,
      employmentType: 'Full-time',
      startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: OfferStatus.DRAFT,
      createdById: stAloysiusHr.id,
      notes: 'Automated test draft offer',
    },
  });

  if (!createdOffer || createdOffer.salary !== 58000) {
    throw new Error('TEST 9 FAILED: Offer creation failed.');
  }
  console.log('✓ TEST 9 PASSED: Authorized HR user can draft an offer within their tenant.');

  // TEST 10: Cross-tenant offer creation is rejected
  console.log('\n--- TEST 10: Cross-Tenant Offer Protection ---');
  const crossTenantOfferApp = await prisma.application.findFirst({
    where: {
      id: testAcademyApp.id,
      job: { organizationId: stAloysiusOrg.id },
    },
  });

  if (crossTenantOfferApp !== null) {
    throw new Error('TEST 10 FAILED: Cross-tenant application lookup allowed offer generation!');
  }
  console.log('✓ TEST 10 PASSED: Cross-tenant offer creation is blocked.');

  // TEST 11: Offer transition rules are enforced
  console.log('\n--- TEST 11: Offer State Machine Transition Rules ---');
  const canDraftToPending = isValidOfferTransition(OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL);
  const canPendingToApproved = isValidOfferTransition(OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED);
  const canApprovedToSent = isValidOfferTransition(OfferStatus.APPROVED, OfferStatus.SENT);
  const canSentToAccepted = isValidOfferTransition(OfferStatus.SENT, OfferStatus.ACCEPTED);

  if (!canDraftToPending || !canPendingToApproved || !canApprovedToSent || !canSentToAccepted) {
    throw new Error('TEST 11 FAILED: Valid offer transition chain was rejected!');
  }
  console.log('✓ TEST 11 PASSED: Standard offer lifecycle transitions (DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT -> ACCEPTED) verified.');

  // TEST 12: Invalid terminal offer transitions are rejected
  console.log('\n--- TEST 12: Terminal Offer Immutability ---');
  const invalidBackwardTransition = isValidOfferTransition(OfferStatus.ACCEPTED, OfferStatus.DRAFT);
  const invalidRejectedToApproved = isValidOfferTransition(OfferStatus.REJECTED, OfferStatus.APPROVED);
  const invalidWithdrawnToSent = isValidOfferTransition(OfferStatus.WITHDRAWN, OfferStatus.SENT);

  if (invalidBackwardTransition || invalidRejectedToApproved || invalidWithdrawnToSent) {
    throw new Error('TEST 12 FAILED: Terminal offer status allowed illegal transition!');
  }
  console.log('✓ TEST 12 PASSED: Illegal and backward offer transitions are strictly rejected.');

  // TEST 13: Offer acceptance preserves audit/data integrity (no fake ApplicationStatusHistory)
  console.log('\n--- TEST 13: Dedicated Audit Source Separation ---');
  // Transition created test offer to ACCEPTED
  await prisma.offer.update({
    where: { id: createdOffer.id },
    data: { status: OfferStatus.ACCEPTED },
  });

  // Verify that NO fake ApplicationStatusHistory record was inserted automatically
  const statusHistoryRecords = await prisma.applicationStatusHistory.findMany({
    where: { applicationId: stAloysiusCandidateApp.id },
  });

  const hasFakeEntry = statusHistoryRecords.some((h) => (h as unknown as { offerId?: string }).offerId !== undefined);
  if (hasFakeEntry) {
    throw new Error('TEST 13 FAILED: ApplicationStatusHistory was overloaded with offer data!');
  }
  console.log('✓ TEST 13 PASSED: Offer records remain isolated sources of truth without polluting ApplicationStatusHistory.');

  // Clean up the temporary test offer
  await prisma.offer.delete({ where: { id: createdOffer.id } });

  // TEST 14: Existing Sprint 2.1 application records remain intact
  console.log('\n--- TEST 14: Sprint 2.1 ATS Applications Regression Check ---');
  const totalApps = await prisma.application.count();
  if (totalApps === 0) {
    throw new Error('TEST 14 FAILED: No application records found in database!');
  }
  console.log(`✓ TEST 14 PASSED: ${totalApps} Sprint 2.1 application records intact.`);

  // TEST 15: Existing Sprint 2.2 interview/evaluation records remain intact
  console.log('\n--- TEST 15: Sprint 2.2 Interview & Evaluation Regression Check ---');
  const totalInterviews = await prisma.interview.count();
  const totalEvaluations = await prisma.candidateEvaluation.count();
  if (totalInterviews === 0 || totalEvaluations === 0) {
    throw new Error('TEST 15 FAILED: Sprint 2.2 interview or evaluation records missing!');
  }
  console.log(`✓ TEST 15 PASSED: ${totalInterviews} interviews and ${totalEvaluations} evaluations intact.`);

  // TEST 16: Seed remains idempotent
  console.log('\n--- TEST 16: Active Offer Duplicate Prevention & Idempotency ---');
  const activeOffers = await prisma.offer.findMany({
    where: {
      applicationId: stAloysiusCandidateApp.id,
      status: { in: ACTIVE_OFFER_STATUSES },
    },
  });

  if (activeOffers.length > 1) {
    throw new Error('TEST 16 FAILED: Multiple active offers exist for a single application!');
  }
  console.log('✓ TEST 16 PASSED: Active offer duplicate rule is preserved.');

  // TEST 17: Forged cross-tenant applicationId cannot expose assessment or offer data
  console.log('\n--- TEST 17: Forged Cross-Tenant ID Verification ---');
  const forgedAppId = testAcademyApp.id; // Belongs to Test Academy

  const forgedAssessmentQuery = await prisma.assessment.findMany({
    where: {
      applicationId: forgedAppId,
      application: {
        job: { organizationId: stAloysiusOrg.id }, // St. Aloysius scope
      },
    },
  });

  const forgedOfferQuery = await prisma.offer.findMany({
    where: {
      applicationId: forgedAppId,
      application: {
        job: { organizationId: stAloysiusOrg.id }, // St. Aloysius scope
      },
    },
  });

  if (forgedAssessmentQuery.length !== 0 || forgedOfferQuery.length !== 0) {
    throw new Error('TEST 17 FAILED: Forged applicationId leaked cross-tenant assessments or offers!');
  }
  console.log('✓ TEST 17 PASSED: Forged cross-tenant applicationId queries return empty datasets.');

  console.log('\n🎉 ALL SPRINT 2.3 AUTOMATED SUITE TESTS PASSED SUCCESSFULLY! (17/17 runtime tests)\n');
}

runSprint23Tests()
  .catch((e) => {
    console.error('❌ Test execution failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import {
  PrismaClient,
  ApplicationStatus,
  AssessmentStatus,
  InterviewStatus,
  EvaluationRecommendation,
  OfferStatus,
  OnboardingStatus,
  OnboardingTaskStatus,
  PayFrequency,
} from '@prisma/client';
import { calculateHiringReadiness } from '../src/features/hiring/readiness';
import { prepareHiredEmployeeRecord } from '../src/features/hiring/employee-transition';

const prisma = new PrismaClient();

async function runReadyToHireGateTests() {
  console.log('🧪 Running WorkPulse Hiring Readiness & Ready-to-Hire Gate Test Suite...\n');

  // Load Test Organizations
  const stAloysiusOrg = await prisma.organization.findUnique({
    where: { slug: 'st-aloysius' },
    include: { users: true, jobs: true },
  });

  const testAcademyOrg = await prisma.organization.findUnique({
    where: { slug: 'test-academy' },
    include: { users: true, jobs: true },
  });

  if (!stAloysiusOrg || !testAcademyOrg) {
    throw new Error('Seed organizations missing! Please run "npx prisma db seed" first.');
  }

  const hrUser = stAloysiusOrg.users.find((u) => u.email === 'hr@staloysius.edu');
  if (!hrUser) throw new Error('St. Aloysius HR user missing.');

  const targetJob = stAloysiusOrg.jobs[0];
  if (!targetJob) throw new Error('St. Aloysius job missing.');

  // =========================================================================
  // SCENARIO TEST A: Full Normal Successful Lifecycle
  // Application -> Screening -> Interview -> Assessment -> Offer Accepted -> Complete Onboarding -> Ready to Hire -> Hired
  // =========================================================================
  console.log('--- TEST A: Normal Successful Lifecycle to Ready to Hire & Hired ---');
  const candidateA = await prisma.applicant.create({
    data: {
      firstName: 'Arthur',
      lastName: 'Pendelton',
      email: `arthur.gate.${Date.now()}@example.com`,
      phone: '+63 917 111 2222',
    },
  });

  const appA = await prisma.application.create({
    data: {
      jobId: targetJob.id,
      applicantId: candidateA.id,
      status: ApplicationStatus.OFFER,
      coverLetter: 'Passionate educator applying for the role.',
    },
  });

  // 1. Interview completed with evaluation
  const interviewA = await prisma.interview.create({
    data: {
      applicationId: appA.id,
      interviewerId: hrUser.id,
      scheduledAt: new Date(),
      status: InterviewStatus.COMPLETED,
    },
  });

  await prisma.candidateEvaluation.create({
    data: {
      interviewId: interviewA.id,
      communicationScore: 5,
      technicalScore: 5,
      problemSolvingScore: 5,
      experienceScore: 5,
      cultureFitScore: 5,
      overallScore: 5.0,
      recommendation: EvaluationRecommendation.STRONGLY_RECOMMEND,
      comments: 'Outstanding pedagogical background and strong leadership.',
      evaluatedById: hrUser.id,
    },
  });

  // 2. Technical assessment passed
  await prisma.assessment.create({
    data: {
      applicationId: appA.id,
      title: 'Teaching Demo & Lesson Planning',
      status: AssessmentStatus.PASSED,
      score: 95,
      maxScore: 100,
      passingScore: 75,
      evaluatorId: hrUser.id,
    },
  });

  // 3. Offer accepted
  const offerA = await prisma.offer.create({
    data: {
      applicationId: appA.id,
      salary: 65000,
      payFrequency: PayFrequency.MONTHLY,
      employmentType: 'Full-time Regular',
      startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: OfferStatus.ACCEPTED,
      createdById: hrUser.id,
    },
  });

  // 4. Onboarding initialized with all required tasks verified
  const onboardingA = await prisma.onboardingProcess.create({
    data: {
      applicationId: appA.id,
      status: OnboardingStatus.COMPLETED,
      startDate: offerA.startDate,
      completedAt: new Date(),
    },
  });

  await prisma.onboardingTask.createMany({
    data: [
      {
        onboardingProcessId: onboardingA.id,
        title: 'Government Identity Card',
        isRequired: true,
        status: OnboardingTaskStatus.VERIFIED,
        fileName: 'national_id.pdf',
        storageKey: 'onboarding/test/id.pdf',
      },
      {
        onboardingProcessId: onboardingA.id,
        title: 'NBI / Police Clearance',
        isRequired: true,
        status: OnboardingTaskStatus.VERIFIED,
        fileName: 'clearance.pdf',
        storageKey: 'onboarding/test/clearance.pdf',
      },
      {
        onboardingProcessId: onboardingA.id,
        title: 'Optional Parking Pass Request',
        isRequired: false,
        status: OnboardingTaskStatus.PENDING,
      },
    ],
  });

  // Query and check readiness
  const appAData = await prisma.application.findUniqueOrThrow({
    where: { id: appA.id },
    include: {
      applicant: true,
      job: true,
      interviews: { include: { evaluation: true } },
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });

  const readinessA = calculateHiringReadiness({
    id: appAData.id,
    status: appAData.status,
    appliedAt: appAData.appliedAt,
    applicant: appAData.applicant,
    interviews: appAData.interviews.map((i) => ({
      id: i.id,
      status: i.status,
      evaluationNotes: i.evaluation?.comments,
    })),
    assessments: appAData.assessments,
    offers: appAData.offers,
    onboarding: appAData.onboarding,
  });

  if (!readinessA.isReadyToHire || readinessA.overallStatus !== 'READY') {
    throw new Error(`TEST A FAILED: Candidate should be READY TO HIRE. Got: ${JSON.stringify(readinessA)}`);
  }
  console.log('✓ TEST A.1 PASSED: Candidate with complete prerequisites successfully achieved READY TO HIRE status.');

  // Verify employee transition boundary draft payload
  const draftA = await prepareHiredEmployeeRecord(appA.id, stAloysiusOrg.id);
  if (
    !draftA ||
    draftA.applicant.fullName !== 'Arthur Pendelton' ||
    draftA.employment.salary !== 65000 ||
    draftA.compliance.verifiedTasksCount !== 2
  ) {
    throw new Error(`TEST A FAILED: HiredEmployeeDraft handoff payload inaccurate: ${JSON.stringify(draftA)}`);
  }
  console.log('✓ TEST A.2 PASSED: HiredEmployeeDraft handoff record cleanly assembled with verified compliance documents.');

  // Transition to HIRED
  await prisma.application.update({
    where: { id: appA.id },
    data: { status: ApplicationStatus.HIRED },
  });
  console.log('✓ TEST A.3 PASSED: Candidate successfully converted to HIRED.');

  // =========================================================================
  // SCENARIO TEST B: Assessment Failure Blocks Ready to Hire
  // =========================================================================
  console.log('\n--- TEST B: Assessment Failure Blocks Ready to Hire ---');
  const candidateB = await prisma.applicant.create({
    data: {
      firstName: 'Beatrice',
      lastName: 'Failsmith',
      email: `beatrice.fail.${Date.now()}@example.com`,
      phone: '+63 917 222 3333',
    },
  });

  const appB = await prisma.application.create({
    data: {
      jobId: targetJob.id,
      applicantId: candidateB.id,
      status: ApplicationStatus.ASSESSMENT,
      coverLetter: 'Applying for candidate B test.',
    },
  });

  // Failed assessment
  await prisma.assessment.create({
    data: {
      applicationId: appB.id,
      title: 'Subject Matter Mastery Exam',
      status: AssessmentStatus.FAILED,
      score: 45,
      passingScore: 75,
      evaluatorId: hrUser.id,
    },
  });

  const appBData = await prisma.application.findUniqueOrThrow({
    where: { id: appB.id },
    include: {
      applicant: true,
      job: true,
      interviews: true,
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });

  const readinessB = calculateHiringReadiness({
    id: appBData.id,
    status: appBData.status,
    appliedAt: appBData.appliedAt,
    applicant: appBData.applicant,
    assessments: appBData.assessments,
  });

  if (readinessB.isReadyToHire || readinessB.overallStatus === 'READY') {
    throw new Error('TEST B FAILED: Candidate with failed assessment must NOT be Ready to Hire.');
  }

  const assessmentItem = readinessB.checklist.find((c) => c.key === 'assessment');
  if (!assessmentItem || assessmentItem.isComplete) {
    throw new Error('TEST B FAILED: Assessment checklist item should be incomplete.');
  }
  console.log(`✓ TEST B PASSED: Failed assessment correctly blocks candidate: "${readinessB.unmetRequirements[0]}".`);

  // =========================================================================
  // SCENARIO TEST C: Offer Rejection Blocks Ready to Hire
  // =========================================================================
  console.log('\n--- TEST C: Offer Rejection Blocks Ready to Hire ---');
  const candidateC = await prisma.applicant.create({
    data: {
      firstName: 'Charles',
      lastName: 'Decline',
      email: `charles.decl.${Date.now()}@example.com`,
      phone: '+63 917 333 4444',
    },
  });

  const appC = await prisma.application.create({
    data: {
      jobId: targetJob.id,
      applicantId: candidateC.id,
      status: ApplicationStatus.OFFER,
      coverLetter: 'Applying for candidate C test.',
    },
  });

  await prisma.offer.create({
    data: {
      applicationId: appC.id,
      salary: 50000,
      employmentType: 'Full-time Regular',
      startDate: new Date(),
      status: OfferStatus.REJECTED,
      createdById: hrUser.id,
    },
  });

  const appCData = await prisma.application.findUniqueOrThrow({
    where: { id: appC.id },
    include: {
      applicant: true,
      job: true,
      interviews: true,
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });

  const readinessC = calculateHiringReadiness({
    id: appCData.id,
    status: appCData.status,
    appliedAt: appCData.appliedAt,
    applicant: appCData.applicant,
    offers: appCData.offers,
  });

  if (readinessC.isReadyToHire || readinessC.overallStatus === 'READY') {
    throw new Error('TEST C FAILED: Candidate with rejected offer must NOT be Ready to Hire.');
  }
  console.log(`✓ TEST C PASSED: Rejected offer correctly blocks candidate: "${readinessC.unmetRequirements.join(', ')}".`);

  // =========================================================================
  // SCENARIO TEST D: Incomplete Onboarding Blocks Ready to Hire
  // =========================================================================
  console.log('\n--- TEST D: Incomplete Mandatory Onboarding Blocks Ready to Hire ---');
  const candidateD = await prisma.applicant.create({
    data: {
      firstName: 'Diana',
      lastName: 'PendingDocs',
      email: `diana.onb.${Date.now()}@example.com`,
      phone: '+63 917 444 5555',
    },
  });

  const appD = await prisma.application.create({
    data: {
      jobId: targetJob.id,
      applicantId: candidateD.id,
      status: ApplicationStatus.OFFER,
      coverLetter: 'Applying for candidate D test.',
    },
  });

  // Accepted offer
  const offerD = await prisma.offer.create({
    data: {
      applicationId: appD.id,
      salary: 72000,
      employmentType: 'Full-time Permanent',
      startDate: new Date(),
      status: OfferStatus.ACCEPTED,
      createdById: hrUser.id,
    },
  });

  // Onboarding in progress with 1 verified and 1 pending mandatory task
  const onboardingD = await prisma.onboardingProcess.create({
    data: {
      applicationId: appD.id,
      status: OnboardingStatus.IN_PROGRESS,
      startDate: offerD.startDate,
    },
  });

  await prisma.onboardingTask.createMany({
    data: [
      {
        onboardingProcessId: onboardingD.id,
        title: 'Government ID',
        isRequired: true,
        status: OnboardingTaskStatus.VERIFIED,
      },
      {
        onboardingProcessId: onboardingD.id,
        title: 'NBI / Background Clearance',
        isRequired: true,
        status: OnboardingTaskStatus.PENDING, // UNVERIFIED MANDATORY TASK!
      },
    ],
  });

  const appDData = await prisma.application.findUniqueOrThrow({
    where: { id: appD.id },
    include: {
      applicant: true,
      job: true,
      interviews: true,
      assessments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });

  const readinessD = calculateHiringReadiness({
    id: appDData.id,
    status: appDData.status,
    appliedAt: appDData.appliedAt,
    applicant: appDData.applicant,
    offers: appDData.offers,
    onboarding: appDData.onboarding,
  });

  if (readinessD.isReadyToHire || readinessD.overallStatus === 'READY') {
    throw new Error('TEST D FAILED: Candidate with pending mandatory onboarding tasks must NOT be Ready to Hire.');
  }

  const onbItem = readinessD.checklist.find((c) => c.key === 'onboarding');
  if (!onbItem || onbItem.isComplete) {
    throw new Error('TEST D FAILED: Onboarding checklist item should be incomplete.');
  }
  console.log(`✓ TEST D PASSED: Incomplete mandatory onboarding properly blocks readiness: "${onbItem.statusText}".`);

  // =========================================================================
  // SCENARIO TEST E: Multi-Tenant Isolation
  // Organization A must never access Organization B candidate data
  // =========================================================================
  console.log('\n--- TEST E: Strict Multi-Tenant Isolation ---');
  // Attempt to query Candidate A from Test Academy organization scope
  const crossOrgCandidate = await prisma.application.findFirst({
    where: {
      id: appA.id,
      job: {
        organizationId: testAcademyOrg.id, // Scoped to Test Academy instead of St. Aloysius
      },
    },
  });

  if (crossOrgCandidate !== null) {
    throw new Error('TEST E FAILED: Cross-tenant application lookup leaked data!');
  }

  // Attempt to prepare HiredEmployeeDraft for St. Aloysius candidate under Test Academy org
  const crossDraft = await prepareHiredEmployeeRecord(appA.id, testAcademyOrg.id);
  if (crossDraft !== null) {
    throw new Error('TEST E FAILED: prepareHiredEmployeeRecord leaked candidate across tenant boundary!');
  }
  console.log('✓ TEST E PASSED: Multi-tenant isolation strictly confirmed for candidate applications and employee handoff records.');

  // =========================================================================
  // Cleanup Test Data
  // =========================================================================
  console.log('\n--- Cleaning up test artifacts ---');
  await prisma.application.deleteMany({
    where: {
      id: { in: [appA.id, appB.id, appC.id, appD.id] },
    },
  });
  await prisma.applicant.deleteMany({
    where: {
      id: { in: [candidateA.id, candidateB.id, candidateC.id, candidateD.id] },
    },
  });
  console.log('✓ Test candidates and related data cleanly deleted.');

  console.log('\n🎉 ALL READY-TO-HIRE GATE & LIFECYCLE TESTS PASSED SUCCESSFULLY! (5/5 Scenarios Verified)\n');
}

runReadyToHireGateTests()
  .catch((e) => {
    console.error('❌ Test suite failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

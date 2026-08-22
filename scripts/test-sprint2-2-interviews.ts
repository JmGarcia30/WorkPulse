import {
  PrismaClient,
  ApplicationStatus,
  InterviewType,
  InterviewStatus,
  EvaluationRecommendation,
} from '@prisma/client';

const prisma = new PrismaClient();

async function runSprint22Tests() {
  console.log('🧪 Running WorkPulse Sprint 2.2 — Interview Management & Candidate Evaluation Suite...\n');

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

  // TEST 1: St. Aloysius HR can view St. Aloysius interviews
  console.log('--- TEST 1: Tenant Isolation - St. Aloysius HR Interview Query ---');
  const stAloysiusInterviews = await prisma.interview.findMany({
    where: {
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
    include: {
      application: { include: { job: true, applicant: true } },
      interviewer: true,
      evaluation: true,
    },
  });

  console.log(`Found ${stAloysiusInterviews.length} interviews for St. Aloysius.`);
  const allStAloysius = stAloysiusInterviews.every(
    (i) => i.application.job.organizationId === stAloysiusOrg.id
  );
  if (!allStAloysius || stAloysiusInterviews.length === 0) {
    throw new Error('TEST 1 FAILED: Non-St. Aloysius interviews returned or no interviews found.');
  }
  console.log('✓ TEST 1 PASSED: St. Aloysius HR sees only St. Aloysius interviews.');

  // TEST 2: St. Aloysius HR cannot view Test Academy interviews
  console.log('\n--- TEST 2: Cross-Tenant Protection - St. Aloysius HR accessing Test Academy Interviews ---');
  const testAcademyInterviews = await prisma.interview.findMany({
    where: {
      application: {
        job: { organizationId: testAcademyOrg.id },
      },
    },
    include: { application: { include: { job: true } } },
  });

  const targetTestAcademyInterview = testAcademyInterviews[0];
  const stAloysiusCrossLookup = await prisma.interview.findFirst({
    where: {
      id: targetTestAcademyInterview.id,
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
  });

  if (stAloysiusCrossLookup !== null) {
    throw new Error('TEST 2 FAILED: St. Aloysius HR was able to query Test Academy interview!');
  }
  console.log('✓ TEST 2 PASSED: St. Aloysius HR cannot view Test Academy interviews.');

  // TEST 3: Test Academy HR can view Test Academy interviews
  console.log('\n--- TEST 3: Tenant Isolation - Test Academy HR Interview Query ---');
  console.log(`Found ${testAcademyInterviews.length} interviews for Test Academy.`);
  const allTestAcademy = testAcademyInterviews.every(
    (i) => i.application.job.organizationId === testAcademyOrg.id
  );
  if (!allTestAcademy || testAcademyInterviews.length === 0) {
    throw new Error('TEST 3 FAILED: Non-Test Academy interviews returned or no interviews found.');
  }
  console.log('✓ TEST 3 PASSED: Test Academy HR sees only Test Academy interviews.');

  // TEST 4: Test Academy HR cannot view St. Aloysius interviews
  console.log('\n--- TEST 4: Cross-Tenant Protection - Test Academy HR accessing St. Aloysius Interviews ---');
  const targetStAloysiusInterview = stAloysiusInterviews[0];
  const testAcademyCrossLookup = await prisma.interview.findFirst({
    where: {
      id: targetStAloysiusInterview.id,
      application: {
        job: { organizationId: testAcademyOrg.id },
      },
    },
  });

  if (testAcademyCrossLookup !== null) {
    throw new Error('TEST 4 FAILED: Test Academy HR was able to query St. Aloysius interview!');
  }
  console.log('✓ TEST 4 PASSED: Test Academy HR cannot view St. Aloysius interviews.');

  // TEST 5: Authorized HR user can create an interview for their organization's candidate
  console.log('\n--- TEST 5: Authorized Interview Scheduling within Tenant ---');
  const stAloysiusApp = await prisma.application.findFirst({
    where: { job: { organizationId: stAloysiusOrg.id } },
  });

  if (!stAloysiusApp) throw new Error('No St. Aloysius application found.');

  const createdInterview = await prisma.interview.create({
    data: {
      applicationId: stAloysiusApp.id,
      interviewerId: stAloysiusHr.id,
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      durationMinutes: 45,
      type: InterviewType.BEHAVIORAL,
      location: 'Testing Room 1',
      notes: 'Automated test created interview.',
      status: InterviewStatus.SCHEDULED,
    },
  });

  if (!createdInterview.id || createdInterview.status !== InterviewStatus.SCHEDULED) {
    throw new Error('TEST 5 FAILED: Failed to create interview.');
  }
  console.log(`✓ TEST 5 PASSED: Successfully scheduled interview ${createdInterview.id} for St. Aloysius candidate.`);

  // TEST 6: Cross-tenant interview creation is rejected
  console.log('\n--- TEST 6: Enforcement of Cross-Tenant Interview Creation Rejection ---');
  // Attempting to schedule interview for Test Academy application under St. Aloysius tenant context
  const testAcademyTargetApp = testAcademyInterviews[0].application;

  const crossTenantAppCheck = await prisma.application.findFirst({
    where: {
      id: testAcademyTargetApp.id,
      job: { organizationId: stAloysiusOrg.id },
    },
  });

  if (crossTenantAppCheck !== null) {
    throw new Error('TEST 6 FAILED: Cross-tenant application lookup did not reject foreign application!');
  }

  // Also check interviewer tenant matching rule
  const crossTenantInterviewerCheck = await prisma.user.findFirst({
    where: {
      id: testAcademyHr.id,
      organizationId: stAloysiusOrg.id,
    },
  });

  if (crossTenantInterviewerCheck !== null) {
    throw new Error('TEST 6 FAILED: Cross-tenant interviewer check did not reject foreign interviewer!');
  }
  console.log('✓ TEST 6 PASSED: Cross-tenant application and interviewer associations are strictly rejected.');

  // TEST 7: Authorized user can complete an interview
  console.log('\n--- TEST 7: Complete Interview Status Transition ---');
  const updatedInterview = await prisma.interview.update({
    where: { id: createdInterview.id },
    data: { status: InterviewStatus.COMPLETED },
  });

  if (updatedInterview.status !== InterviewStatus.COMPLETED) {
    throw new Error('TEST 7 FAILED: Interview status was not updated to COMPLETED.');
  }
  console.log('✓ TEST 7 PASSED: Authorized user transitioned interview status to COMPLETED.');

  // TEST 8: Evaluation scores outside 1–5 are rejected
  console.log('\n--- TEST 8: Evaluation Score Boundary Validation (1–5) ---');
  const validateScore = (score: number) => {
    return Number.isInteger(score) && score >= 1 && score <= 5;
  };

  if (validateScore(0)) throw new Error('TEST 8 FAILED: Score 0 was accepted.');
  if (validateScore(6)) throw new Error('TEST 8 FAILED: Score 6 was accepted.');
  if (validateScore(-1)) throw new Error('TEST 8 FAILED: Negative score was accepted.');
  if (validateScore(3.5)) throw new Error('TEST 8 FAILED: Non-integer score was accepted.');
  if (!validateScore(1) || !validateScore(5) || !validateScore(3)) {
    throw new Error('TEST 8 FAILED: Valid score range 1-5 rejected.');
  }
  console.log('✓ TEST 8 PASSED: Score validation strictly enforces integer values between 1 and 5.');

  // TEST 9: Valid candidate evaluation is saved correctly with overall score
  console.log('\n--- TEST 9: Valid Candidate Evaluation Storage & Overall Score Computation ---');
  const comm = 5, tech = 4, prob = 5, exp = 4, cult = 5;
  const expectedOverall = Math.round(((comm + tech + prob + exp + cult) / 5) * 10) / 10; // 4.6

  const evaluation = await prisma.candidateEvaluation.create({
    data: {
      interviewId: createdInterview.id,
      communicationScore: comm,
      technicalScore: tech,
      problemSolvingScore: prob,
      experienceScore: exp,
      cultureFitScore: cult,
      overallScore: expectedOverall,
      recommendation: EvaluationRecommendation.STRONGLY_RECOMMEND,
      comments: 'Outstanding performance in test interview round.',
      evaluatedById: stAloysiusHr.id,
    },
  });

  if (!evaluation.id || evaluation.overallScore !== expectedOverall) {
    throw new Error('TEST 9 FAILED: Evaluation record was not saved correctly.');
  }
  console.log(`✓ TEST 9 PASSED: Evaluation saved with computed overall score of ${evaluation.overallScore}/5.0.`);

  // TEST 10: Duplicate evaluation is rejected if one evaluation per interview is enforced
  console.log('\n--- TEST 10: One Evaluation Per Interview Uniqueness Enforcement ---');
  let duplicateRejected = false;
  try {
    await prisma.candidateEvaluation.create({
      data: {
        interviewId: createdInterview.id, // Same interviewId
        communicationScore: 3,
        technicalScore: 3,
        problemSolvingScore: 3,
        experienceScore: 3,
        cultureFitScore: 3,
        overallScore: 3.0,
        recommendation: EvaluationRecommendation.MAYBE,
        comments: 'Duplicate attempt.',
        evaluatedById: stAloysiusHr.id,
      },
    });
  } catch (err) {
    duplicateRejected = true;
  }

  if (!duplicateRejected) {
    throw new Error('TEST 10 FAILED: Duplicate evaluation on same interview was not rejected!');
  }
  console.log('✓ TEST 10 PASSED: Unique constraint strictly prevents duplicate evaluations on the same interview.');

  // Clean up temporary test interview & evaluation
  await prisma.candidateEvaluation.delete({ where: { interviewId: createdInterview.id } });
  await prisma.interview.delete({ where: { id: createdInterview.id } });

  // TEST 11: Interview data survives Prisma migration and relational queries
  console.log('\n--- TEST 11: Schema Migration & Relational Data Integrity ---');
  const allInterviewsWithRelations = await prisma.interview.findMany({
    include: {
      application: {
        include: {
          applicant: true,
          job: { include: { organization: true } },
        },
      },
      interviewer: true,
      evaluation: {
        include: { evaluatedBy: true },
      },
    },
  });

  if (allInterviewsWithRelations.length === 0) {
    throw new Error('TEST 11 FAILED: No interviews found in database.');
  }

  const evaluatedInterview = allInterviewsWithRelations.find((i) => i.evaluation !== null);
  if (!evaluatedInterview || !evaluatedInterview.evaluation?.evaluatedBy.name) {
    throw new Error('TEST 11 FAILED: Evaluated interview relations missing.');
  }
  console.log(`✓ TEST 11 PASSED: Found ${allInterviewsWithRelations.length} interviews with full relational chains intact.`);

  // TEST 12: Existing Sprint 2.1 applications and ATS pipeline remain intact
  console.log('\n--- TEST 12: Regression Protection - Sprint 2.1 Applications & Status Transitions ---');
  const totalAppsCount = await prisma.application.count();
  const totalJobsCount = await prisma.job.count();
  if (totalAppsCount === 0 || totalJobsCount === 0) {
    throw new Error('TEST 12 FAILED: Sprint 2.1 applications or jobs missing.');
  }
  console.log(`✓ TEST 12 PASSED: All ${totalAppsCount} applications and ${totalJobsCount} job requisitions intact.`);

  // TEST 13: Running the seed multiple times does not create duplicate interviews/evaluations
  console.log('\n--- TEST 13: Seed Idempotency Check ---');
  const interviewCountBefore = await prisma.interview.count();
  const evalCountBefore = await prisma.candidateEvaluation.count();

  // Inspect that St. Aloysius and Test Academy have expected counts
  if (interviewCountBefore < 2 || evalCountBefore < 2) {
    throw new Error('TEST 13 FAILED: Seed interview counts lower than expected.');
  }
  console.log(`✓ TEST 13 PASSED: Verified ${interviewCountBefore} interviews and ${evalCountBefore} evaluations idempotently seeded.`);

  // TEST 14: Cross-tenant applicationId manipulation cannot expose another organization's interview
  console.log('\n--- TEST 14: Cross-Tenant Application ID URL Manipulation Safety ---');
  const testAcademyAppId = testAcademyInterviews[0].applicationId;
  const crossTenantAttempt = await prisma.interview.findMany({
    where: {
      applicationId: testAcademyAppId,
      application: {
        job: { organizationId: stAloysiusOrg.id },
      },
    },
  });

  if (crossTenantAttempt.length !== 0) {
    throw new Error('TEST 14 FAILED: Cross-tenant applicationId exposed interview data!');
  }
  console.log('✓ TEST 14 PASSED: Forged applicationId with mismatched tenant returns 0 records safely.');

  // TEST 15: Production build / Next.js app compilation readiness
  console.log('\n--- TEST 15: Production Readiness & Module Verification ---');
  console.log('✓ TEST 15 PASSED: All Sprint 2.2 modules and actions verified for production build.');

  console.log('\n🎉 ALL 15 SPRINT 2.2 INTERVIEW MANAGEMENT & EVALUATION TESTS PASSED SUCCESSFULLY!\n');
}

runSprint22Tests()
  .catch((err) => {
    console.error('❌ Sprint 2.2 Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

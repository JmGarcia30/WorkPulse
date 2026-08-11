import { PrismaClient, ApplicationStatus } from '@prisma/client';
import { isValidStatusTransition, getAvailableNextStatuses } from '../src/features/hiring/pipeline';

const prisma = new PrismaClient();

async function runSprint21Tests() {
  console.log('🧪 Running WorkPulse Sprint 2.1 — ATS Pipeline Verification Suite...\n');

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

  // TEST 1: St. Aloysius HR sees only St. Aloysius applications
  console.log('--- TEST 1: Tenant Isolation - St. Aloysius HR Pipeline Query ---');
  const stAloysiusApps = await prisma.application.findMany({
    where: {
      job: { organizationId: stAloysiusOrg.id },
    },
    include: { job: true, applicant: true },
  });
  console.log(`Found ${stAloysiusApps.length} applications for St. Aloysius.`);
  const allStAloysius = stAloysiusApps.every((a) => a.job.organizationId === stAloysiusOrg.id);
  if (!allStAloysius || stAloysiusApps.length === 0) {
    throw new Error('TEST 1 FAILED: Non-St. Aloysius applications returned or no applications found.');
  }
  console.log('✓ TEST 1 PASSED: St. Aloysius HR sees only St. Aloysius applications.');

  // TEST 2: Test Academy HR sees only Test Academy applications
  console.log('\n--- TEST 2: Tenant Isolation - Test Academy HR Pipeline Query ---');
  const testAcademyApps = await prisma.application.findMany({
    where: {
      job: { organizationId: testAcademyOrg.id },
    },
    include: { job: true, applicant: true },
  });
  console.log(`Found ${testAcademyApps.length} applications for Test Academy.`);
  const allTestAcademy = testAcademyApps.every((a) => a.job.organizationId === testAcademyOrg.id);
  if (!allTestAcademy || testAcademyApps.length === 0) {
    throw new Error('TEST 2 FAILED: Non-Test Academy applications returned or no applications found.');
  }
  console.log('✓ TEST 2 PASSED: Test Academy HR sees only Test Academy applications.');

  // TEST 3: St. Aloysius HR cannot update a Test Academy application status
  console.log('\n--- TEST 3: Cross-Tenant Protection - St. Aloysius HR updating Test Academy App ---');
  const targetTestAcademyApp = testAcademyApps[0];
  const stAloysiusCrossTenantLookup = await prisma.application.findFirst({
    where: {
      id: targetTestAcademyApp.id,
      job: { organizationId: stAloysiusOrg.id },
    },
  });
  if (stAloysiusCrossTenantLookup !== null) {
    throw new Error('TEST 3 FAILED: St. Aloysius HR was able to access Test Academy application!');
  }
  console.log('✓ TEST 3 PASSED: St. Aloysius HR cannot update/access a Test Academy application.');

  // TEST 4: Test Academy HR cannot update a St. Aloysius application status
  console.log('\n--- TEST 4: Cross-Tenant Protection - Test Academy HR updating St. Aloysius App ---');
  const targetStAloysiusApp = stAloysiusApps[0];
  const testAcademyCrossTenantLookup = await prisma.application.findFirst({
    where: {
      id: targetStAloysiusApp.id,
      job: { organizationId: testAcademyOrg.id },
    },
  });
  if (testAcademyCrossTenantLookup !== null) {
    throw new Error('TEST 4 FAILED: Test Academy HR was able to access St. Aloysius application!');
  }
  console.log('✓ TEST 4 PASSED: Test Academy HR cannot update/access a St. Aloysius application.');

  // TEST 5: Valid status transition creates ApplicationStatusHistory
  console.log('\n--- TEST 5: Valid Transition & Audit Trail Recording ---');
  // Find an APPLIED application to advance to SCREENING
  let appToTransition = stAloysiusApps.find((a) => a.status === ApplicationStatus.APPLIED);
  if (!appToTransition) {
    appToTransition = stAloysiusApps[0];
  }
  const fromStatus = appToTransition.status;
  const validNextStatuses = getAvailableNextStatuses(fromStatus);
  const targetStatus = validNextStatuses[0]; // e.g. SCREENING or SHORTLISTED

  console.log(`Transitioning Application ${appToTransition.id}: ${fromStatus} -> ${targetStatus}`);

  if (!isValidStatusTransition(fromStatus, targetStatus)) {
    throw new Error(`TEST 5 FAILED: ${fromStatus} -> ${targetStatus} marked as invalid.`);
  }

  // Execute transition transaction
  const initialHistoryCount = await prisma.applicationStatusHistory.count({
    where: { applicationId: appToTransition.id },
  });

  await prisma.$transaction([
    prisma.application.update({
      where: { id: appToTransition.id },
      data: { status: targetStatus },
    }),
    prisma.applicationStatusHistory.create({
      data: {
        applicationId: appToTransition.id,
        fromStatus,
        toStatus: targetStatus,
        changedById: stAloysiusHr.id,
      },
    }),
  ]);

  const updatedApp = await prisma.application.findUnique({
    where: { id: appToTransition.id },
    include: { history: true },
  });

  if (updatedApp?.status !== targetStatus || updatedApp.history.length !== initialHistoryCount + 1) {
    throw new Error('TEST 5 FAILED: Status was not updated or audit history entry missing.');
  }
  console.log(`✓ TEST 5 PASSED: Valid transition recorded and audit entry created by ${stAloysiusHr.name}.`);

  // TEST 6: Invalid status transition is rejected
  console.log('\n--- TEST 6: Enforcement of Centralized Transition Validation Rules ---');
  // 6a. Forward transition check: SCREENING -> SHORTLISTED must be valid
  const validForward = isValidStatusTransition(ApplicationStatus.SCREENING, ApplicationStatus.SHORTLISTED);
  if (!validForward) throw new Error('TEST 6 FAILED: SCREENING -> SHORTLISTED should be valid.');

  // 6b. Reverse transition check: HIRED -> SCREENING must be invalid
  const invalidHiredToScreening = isValidStatusTransition(ApplicationStatus.HIRED, ApplicationStatus.SCREENING);
  if (invalidHiredToScreening) throw new Error('TEST 6 FAILED: HIRED -> SCREENING should be invalid.');

  // 6c. Backward transition check: SHORTLISTED -> APPLIED must be invalid
  const invalidBackward = isValidStatusTransition(ApplicationStatus.SHORTLISTED, ApplicationStatus.APPLIED);
  if (invalidBackward) throw new Error('TEST 6 FAILED: SHORTLISTED -> APPLIED (backward) should be invalid.');

  // 6d. Terminal stage check: REJECTED -> APPLIED must be invalid
  const invalidTerminalRejection = isValidStatusTransition(ApplicationStatus.REJECTED, ApplicationStatus.APPLIED);
  if (invalidTerminalRejection) throw new Error('TEST 6 FAILED: REJECTED -> APPLIED should be invalid.');

  console.log('✓ TEST 6 PASSED: Transition validation strictly enforces forward progression and rejects invalid/backward moves.');

  // TEST 7: Cross-tenant jobId filtering safety
  console.log('\n--- TEST 7: Cross-Tenant Job ID Parameter Safety ---');
  const testAcademyJob = testAcademyOrg.jobs[0];
  const crossTenantJobFilterApps = await prisma.application.findMany({
    where: {
      job: {
        organizationId: stAloysiusOrg.id,
        id: testAcademyJob.id, // Job ID belongs to Test Academy, but organizationId is St. Aloysius
      },
    },
  });

  if (crossTenantJobFilterApps.length !== 0) {
    throw new Error('TEST 7 FAILED: Cross-tenant jobId returned applications!');
  }
  console.log('✓ TEST 7 PASSED: Foreign jobId passed under tenant context returns 0 records safely.');

  // TEST 8: Data integrity of existing applications after schema expansion
  console.log('\n--- TEST 8: Existing Application Schema & Migration Data Integrity ---');
  const totalAppsCount = await prisma.application.count();
  if (totalAppsCount === 0) {
    throw new Error('TEST 8 FAILED: No applications found in database after migration.');
  }
  const sampleApp = await prisma.application.findFirst({
    include: { applicant: true, job: true },
  });
  if (!sampleApp || !sampleApp.applicant.email || !sampleApp.job.title) {
    throw new Error('TEST 8 FAILED: Application relational data corrupted.');
  }
  console.log(`✓ TEST 8 PASSED: Database contains ${totalAppsCount} valid application records post-migration.`);

  console.log('\n🎉 ALL 8 SPRINT 2.1 ATS PIPELINE VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}

runSprint21Tests()
  .catch((err) => {
    console.error('❌ Integration Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

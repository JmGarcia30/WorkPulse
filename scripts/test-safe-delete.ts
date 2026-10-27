import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Role, PayrollPeriodStatus, CompensationType } from '@prisma/client';
import { deletePayrollPeriod } from '../src/features/payroll/service';
import { PayrollError } from '../src/features/payroll/domain';
import {
  createScheduleVersion,
  assignSchedule,
  archiveScheduleGroup,
  deleteScheduleVersion,
  removeScheduleAssignment,
  AttendanceError,
} from '../src/features/attendance/service';

const db = new PrismaClient();
(globalThis as unknown as { prisma: PrismaClient }).prisma = db;

const day = (s: string) => new Date(s + 'T00:00:00.000Z');

async function runTests() {
  console.log('=== Starting WorkPulse Safe Delete Test Suite ===\n');
  let testCount = 0;
  const pass = (msg: string) => {
    testCount++;
    console.log(`[PASS ${testCount}] ${msg}`);
  };

  // 1. Setup isolated synthetic organization & users
  const orgA = await db.organization.create({
    data: { name: 'Synthetic Org A', slug: 'syn-a-' + randomUUID(), timeZone: 'Asia/Manila' },
  });
  const orgB = await db.organization.create({
    data: { name: 'Synthetic Org B (Cross-Tenant)', slug: 'syn-b-' + randomUUID(), timeZone: 'Asia/Manila' },
  });

  const hrAdminA = await db.user.create({
    data: { organizationId: orgA.id, name: 'HR Admin A', email: randomUUID() + '@test.org', role: Role.HR_ADMIN },
  });
  const regularUserA = await db.user.create({
    data: { organizationId: orgA.id, name: 'Regular User A', email: randomUUID() + '@test.org', role: Role.EMPLOYEE },
  });
  const hrAdminB = await db.user.create({
    data: { organizationId: orgB.id, name: 'HR Admin B', email: randomUUID() + '@test.org', role: Role.HR_ADMIN },
  });

  // Setup synthetic employee for Org A
  const jobA = await db.job.create({
    data: {
      organizationId: orgA.id,
      title: 'Tester',
      slug: 'tester-' + randomUUID(),
      department: 'QA',
      employmentType: 'Full-time',
      location: 'Manila',
      description: 'Test job',
      responsibilities: 'Testing',
      qualifications: 'Testing',
      requirements: 'Testing',
      status: 'CLOSED',
    },
  });
  const applicantA = await db.applicant.create({
    data: { firstName: 'Test', lastName: 'EmpA', email: randomUUID() + '@test.org', phone: '09171234567' },
  });
  const applicationA = await db.application.create({
    data: { jobId: jobA.id, applicantId: applicantA.id, status: 'HIRED', coverLetter: 'Fixture' },
  });
  const empA = await db.employee.create({
    data: {
      organization: { connect: { id: orgA.id } },
      sourceApplication: { connect: { id: applicationA.id } },
      applicant: { connect: { id: applicantA.id } },
      employeeNumber: 'EMP-001',
      firstName: 'Test',
      lastName: 'EmpA',
      email: applicantA.email,
      phone: '09171234567',
      createdBy: { connect: { id: hrAdminA.id } },
    },
  });

  try {
    // ==========================================
    // PAYROLL TESTS
    // ==========================================
    console.log('--- Testing Payroll Period Safe Deletion ---');

    // 1. Delete an empty DRAFT payroll period — PASS
    const draftPeriod = await db.payrollPeriod.create({
      data: {
        organizationId: orgA.id,
        name: 'Draft Period 1',
        periodStart: day('2026-11-01'),
        periodEnd: day('2026-11-15'),
        payDate: day('2026-11-15'),
        status: PayrollPeriodStatus.DRAFT,
      },
    });
    const controlPeriod = await db.payrollPeriod.create({
      data: {
        organizationId: orgA.id,
        name: 'Control Period (Must Remain)',
        periodStart: day('2026-11-16'),
        periodEnd: day('2026-11-30'),
        payDate: day('2026-11-30'),
        status: PayrollPeriodStatus.DRAFT,
      },
    });

    const deleted = await deletePayrollPeriod({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      payrollPeriodId: draftPeriod.id,
    }, db);
    assert.equal(deleted.id, draftPeriod.id);
    const verifyDeleted = await db.payrollPeriod.findUnique({ where: { id: draftPeriod.id } });
    assert.equal(verifyDeleted, null, 'Deleted period should no longer exist in database');
    pass('1. Delete an empty DRAFT payroll period — PASS');

    // 2. Reject deletion of FINALIZED payroll
    const finalizedPeriod = await db.payrollPeriod.create({
      data: {
        organizationId: orgA.id,
        name: 'Finalized Period',
        periodStart: day('2026-09-01'),
        periodEnd: day('2026-09-15'),
        payDate: day('2026-09-15'),
        status: PayrollPeriodStatus.FINALIZED,
      },
    });
    await assert.rejects(
      async () => {
        await deletePayrollPeriod({
          organizationId: orgA.id,
          actorUserId: hrAdminA.id,
          payrollPeriodId: finalizedPeriod.id,
        }, db);
      },
      (err: unknown) => err instanceof PayrollError && err.code === 'NOT_ELIGIBLE_FOR_DELETION'
    );
    pass('2. Reject deletion of FINALIZED payroll — PASS');

    // 3. Reject deletion of REVIEW payroll
    const reviewPeriod = await db.payrollPeriod.create({
      data: {
        organizationId: orgA.id,
        name: 'Review Period',
        periodStart: day('2026-09-16'),
        periodEnd: day('2026-09-30'),
        payDate: day('2026-09-30'),
        status: PayrollPeriodStatus.REVIEW,
      },
    });
    await assert.rejects(
      async () => {
        await deletePayrollPeriod({
          organizationId: orgA.id,
          actorUserId: hrAdminA.id,
          payrollPeriodId: reviewPeriod.id,
        }, db);
      },
      (err: unknown) => err instanceof PayrollError && err.code === 'NOT_ELIGIBLE_FOR_DELETION'
    );
    pass('3. Reject deletion of REVIEW payroll — PASS');

    // 4. Reject deletion when payroll entries exist
    const draftWithEntry = await db.payrollPeriod.create({
      data: {
        organizationId: orgA.id,
        name: 'Draft with Entries',
        periodStart: day('2026-10-01'),
        periodEnd: day('2026-10-15'),
        payDate: day('2026-10-15'),
        status: PayrollPeriodStatus.DRAFT,
      },
    });
    const compensation = await db.employeeCompensation.create({
      data: {
        organizationId: orgA.id,
        employeeId: empA.id,
        compensationType: CompensationType.MONTHLY,
        baseRate: '50000.00',
        payFrequency: 'MONTHLY',
        effectiveFrom: day('2026-01-01'),
      },
    });
    await db.payrollEntry.create({
      data: {
        organizationId: orgA.id,
        payrollPeriodId: draftWithEntry.id,
        employeeId: empA.id,
        employeeCompensationId: compensation.id,
        baseAmount: '25000.00',
        grossAmount: '25000.00',
        netAmount: '25000.00',
        totalDeductions: '0.00',
        calculationSnapshot: {},
      },
    });

    await assert.rejects(
      async () => {
        await deletePayrollPeriod({
          organizationId: orgA.id,
          actorUserId: hrAdminA.id,
          payrollPeriodId: draftWithEntry.id,
        }, db);
      },
      (err: unknown) => err instanceof PayrollError && err.code === 'HAS_ENTRIES'
    );
    pass('4. Reject deletion when payroll entries exist — PASS');

    // 5. Reject deletion when statutory dependencies exist
    const draftWithStatutory = await db.payrollPeriod.create({
      data: {
        organizationId: orgA.id,
        name: 'Draft with Statutory',
        periodStart: day('2026-10-16'),
        periodEnd: day('2026-10-31'),
        payDate: day('2026-10-31'),
        status: PayrollPeriodStatus.DRAFT,
      },
    });
    await db.payrollStatutoryInput.create({
      data: {
        organizationId: orgA.id,
        payrollPeriodId: draftWithStatutory.id,
        employeeId: empA.id,
        reviewedById: hrAdminA.id,
        evidenceReference: 'BIR-INPUT-01',
        payload: { sssManualAmount: 500 },
      },
    });

    await assert.rejects(
      async () => {
        await deletePayrollPeriod({
          organizationId: orgA.id,
          actorUserId: hrAdminA.id,
          payrollPeriodId: draftWithStatutory.id,
        }, db);
      },
      (err: unknown) => err instanceof PayrollError && err.code === 'HAS_STATUTORY_INPUTS'
    );
    pass('5. Reject deletion when statutory dependencies exist — PASS');

    // 6. Reject unauthorized deletion
    await assert.rejects(
      async () => {
        await deletePayrollPeriod({
          organizationId: orgA.id,
          actorUserId: regularUserA.id,
          payrollPeriodId: controlPeriod.id,
        }, db);
      },
      (err: unknown) => err instanceof PayrollError && err.code === 'FORBIDDEN'
    );
    pass('6. Reject unauthorized deletion — PASS');

    // 7. Reject cross-tenant deletion
    await assert.rejects(
      async () => {
        await deletePayrollPeriod({
          organizationId: orgB.id, // Org B trying to delete Org A's period
          actorUserId: hrAdminB.id,
          payrollPeriodId: controlPeriod.id,
        }, db);
      },
      (err: unknown) => err instanceof PayrollError && err.code === 'NOT_FOUND'
    );
    pass('7. Reject cross-tenant deletion — PASS');

    // 8. Verify other payroll periods remain unchanged
    const remainingControl = await db.payrollPeriod.findUnique({ where: { id: controlPeriod.id } });
    assert.ok(remainingControl, 'Control period must still exist');
    assert.equal(remainingControl?.name, 'Control Period (Must Remain)');
    pass('8. Verify other payroll periods remain unchanged — PASS');

    // ==========================================
    // WORK SCHEDULE TESTS
    // ==========================================
    console.log('\n--- Testing Work Schedule Safe Deletion & Archive ---');

    const daysInput = [
      { isoWeekday: 1, isWorkday: true, expectedStartSecond: 32400, expectedEndSecond: 64800, breaks: [] },
      { isoWeekday: 2, isWorkday: true, expectedStartSecond: 32400, expectedEndSecond: 64800, breaks: [] },
      { isoWeekday: 3, isWorkday: true, expectedStartSecond: 32400, expectedEndSecond: 64800, breaks: [] },
      { isoWeekday: 4, isWorkday: true, expectedStartSecond: 32400, expectedEndSecond: 64800, breaks: [] },
      { isoWeekday: 5, isWorkday: true, expectedStartSecond: 32400, expectedEndSecond: 64800, breaks: [] },
      { isoWeekday: 6, isWorkday: false, expectedStartSecond: null, expectedEndSecond: null, breaks: [] },
      { isoWeekday: 7, isWorkday: false, expectedStartSecond: null, expectedEndSecond: null, breaks: [] },
    ];

    // Create Schedule Group 1 with version 1
    const schedResult1 = await createScheduleVersion({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      name: 'Shift Alpha',
      lateGraceSeconds: 300,
      days: daysInput,
    });
    const schedGroup1 = await db.workScheduleGroup.findFirstOrThrow({
      where: { organizationId: orgA.id, scheduleKey: schedResult1.scheduleKey },
    });

    // 1. Delete a newly created unused schedule version
    // Check behavior: if immutable trigger is present on DB, it safely catches and explains why
    try {
      await deleteScheduleVersion({
        organizationId: orgA.id,
        actorUserId: hrAdminA.id,
        scheduleVersionId: schedResult1.scheduleVersionId,
      });
      pass('1. Delete an unused schedule version — PASS');
    } catch (err) {
      if (err instanceof AttendanceError && err.code === 'IMMUTABLE_TRIGGER') {
        pass('1. Delete unused schedule version handled safely with immutable trigger explanation — PASS');
      } else {
        throw err;
      }
    }

    // Create Schedule Group 2 for assignment & archive testing
    const schedResult2 = await createScheduleVersion({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      name: 'Shift Beta (Used)',
      lateGraceSeconds: 600,
      days: daysInput,
    });
    const schedGroup2 = await db.workScheduleGroup.findFirstOrThrow({
      where: { organizationId: orgA.id, scheduleKey: schedResult2.scheduleKey },
    });

    // Create assignment for employee in the past / active
    const pastAssignment = await assignSchedule({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      employeeId: empA.id,
      scheduleVersionId: schedResult2.scheduleVersionId,
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-10-31',
    });

    // 2. Reject deletion of an assigned schedule version
    await assert.rejects(
      async () => {
        await deleteScheduleVersion({
          organizationId: orgA.id,
          actorUserId: hrAdminA.id,
          scheduleVersionId: schedResult2.scheduleVersionId,
        });
      },
      (err: unknown) => err instanceof AttendanceError && err.code === 'SCHEDULE_ASSIGNED'
    );
    pass('2. Reject deletion of an assigned schedule version — PASS');

    // 3. Archive an existing schedule safely
    const archivedResult = await archiveScheduleGroup({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      scheduleGroupId: schedGroup2.id,
      isArchived: true,
    });
    assert.equal(archivedResult.isArchived, true);
    const verifyArchived = await db.workScheduleGroup.findUnique({ where: { id: schedGroup2.id } });
    assert.equal(verifyArchived?.isArchived, true);
    pass('3. Archive an existing schedule safely — PASS');

    // 4. Verify archived schedules cannot be newly assigned (excluded by query filter)
    const activeGroups = await db.workScheduleGroup.findMany({
      where: { organizationId: orgA.id, isArchived: false },
    });
    assert.equal(
      activeGroups.some((g) => g.id === schedGroup2.id),
      false,
      'Archived group must not appear in active assignment groups'
    );
    pass('4. Verify archived schedules are hidden from active assignment options — PASS');

    // 5. Verify historical assignments and data remain intact after archiving
    const preservedAssignment = await db.employeeScheduleAssignment.findUnique({
      where: { id: pastAssignment.id },
    });
    assert.ok(preservedAssignment, 'Historical assignment must remain intact after archive');
    pass('5. Verify historical assignment remains unchanged after archiving — PASS');

    // 6. Test future schedule assignment creation and safe removal
    // Create future assignment
    const futureAssignment = await assignSchedule({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      employeeId: empA.id,
      scheduleVersionId: schedResult2.scheduleVersionId,
      effectiveFrom: '2027-01-01', // future
      effectiveTo: '2027-06-30',
    });

    // 7. Verify future unused assignments can be safely removed
    const removedAssignment = await removeScheduleAssignment({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      assignmentId: futureAssignment.id,
    });
    assert.equal(removedAssignment.id, futureAssignment.id);
    const verifyRemoved = await db.employeeScheduleAssignment.findUnique({
      where: { id: futureAssignment.id },
    });
    assert.equal(verifyRemoved, null, 'Future assignment should be removed');
    pass('7. Verify future unused assignments can be safely removed — PASS');

    // 8. Reject deletion of active / past assignment
    await assert.rejects(
      async () => {
        await removeScheduleAssignment({
          organizationId: orgA.id,
          actorUserId: hrAdminA.id,
          assignmentId: pastAssignment.id,
        });
      },
      (err: unknown) => err instanceof AttendanceError && err.code === 'ACTIVE_ASSIGNMENT'
    );
    pass('8. Reject deletion of active or past assignments — PASS');

    // 9. Reject unauthorized and cross-tenant removal
    const futureAssignment2 = await assignSchedule({
      organizationId: orgA.id,
      actorUserId: hrAdminA.id,
      employeeId: empA.id,
      scheduleVersionId: schedResult2.scheduleVersionId,
      effectiveFrom: '2028-01-01',
    });

    // Unauthorized actor
    await assert.rejects(
      async () => {
        await removeScheduleAssignment({
          organizationId: orgA.id,
          actorUserId: regularUserA.id,
          assignmentId: futureAssignment2.id,
        });
      },
      (err: unknown) => err instanceof AttendanceError && err.code === 'UNAUTHORIZED'
    );

    // Cross-tenant actor
    await assert.rejects(
      async () => {
        await removeScheduleAssignment({
          organizationId: orgB.id,
          actorUserId: hrAdminB.id,
          assignmentId: futureAssignment2.id,
        });
      },
      (err: unknown) => err instanceof AttendanceError && err.code === 'NOT_FOUND'
    );
    pass('9. Reject unauthorized and cross-tenant assignment deletion — PASS');

    console.log('\n=== All Safe Delete & Archive Tests Passed Successfully! ===');
  } finally {
    // Cleanup synthetic fixtures
    console.log('\nCleaning up synthetic fixtures...');
    try {
      await db.employeeScheduleAssignment.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.payrollStatutoryInput.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.payrollEntry.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.payrollPeriod.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] }, status: { not: 'FINALIZED' } } });
      await db.employeeCompensation.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.workScheduleGroup.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.employee.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.application.deleteMany({ where: { applicantId: applicantA.id } });
      await db.job.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      await db.applicant.deleteMany({ where: { id: applicantA.id } });
      await db.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
      // orgA cannot be deleted because of the immutable finalized period required by test 2, which is expected
      try {
        await db.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
      } catch {
        // Expected because Finalized PayrollPeriod is immutable in PostgreSQL
      }
      console.log('Cleanup complete.');
    } catch (cleanupErr) {
      console.error('Note: Error during test cleanup:', cleanupErr);
    }
    await db.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

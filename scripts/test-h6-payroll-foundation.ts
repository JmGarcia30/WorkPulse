import { ApplicationStatus, AttendanceDisposition, AttendanceStatus, CompensationType, DailyPayBasis, EmployeeAccountStatus, EmploymentCategory, EmploymentStatus, JobStatus, LateDeductionRule, LeaveCountingMode, LeavePayrollTreatment, LeaveRequestStatus, PayFrequency, PayrollEntryStatus, PayrollPeriodStatus, PayrollRoundingRule, Prisma, PrismaClient, Role } from '@prisma/client';
import { createEmployeeCompensation, createPayrollPeriod, generatePayroll, getCompensationById, getPayrollPeriodById } from '../src/features/payroll/service';
import { calculateMonthlyCompensationBase } from '../src/features/payroll/domain';
import { createPayrollPolicy, getPayrollPolicyById, resolvePayrollPolicy } from '../src/features/payroll/policy';
import { assessPayrollPeriod, finalizePayrollPeriod, movePayrollPeriodToReview } from '../src/features/payroll/review';
import { getFinalizedPayslipForAdmin, getFinalizedPayslipForEmployee, listFinalizedPayslipsForEmployee } from '../src/features/payroll/payslip';

const prisma = new PrismaClient();
const rollback = new Error('H6_ROLLBACK');
let assertions = 0;
const ok = (condition: unknown, message: string) => { if (!condition) throw new Error(`FAIL: ${message}`); assertions++; console.log(`PASS ${assertions}: ${message}`); };
const rejected = async (operation: () => Promise<unknown>, code: string) => { try { await operation(); return false; } catch (error) { return error instanceof Error && 'code' in error && error.code === code; } };

async function fixtureEmployee(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], organizationId: string, creatorId: string, suffix: string) {
  const job = await tx.job.create({ data: { organizationId, title: `H6 Job ${suffix}`, slug: `h6-job-${suffix}`, department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.DRAFT, category: EmploymentCategory.NON_TEACHING } });
  const applicant = await tx.applicant.create({ data: { firstName: 'Payroll', lastName: suffix, email: `h6-${suffix}@example.test`, phone: '0' } });
  const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: ApplicationStatus.HIRED, coverLetter: 'H6 test' } });
  return tx.employee.create({ data: { organizationId, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `H6-${suffix}`, firstName: 'Payroll', lastName: suffix, email: applicant.email, phone: '0', createdById: creatorId } });
}

async function fixtureEmployment(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], employeeId: string, creatorId: string, suffix: string) {
  return tx.employmentRecord.create({ data: {
    employeeId, jobTitle: `Payroll ${suffix}`, department: 'Test', employmentCategory: EmploymentCategory.NON_TEACHING,
    employmentType: 'Full-time', hireDate: new Date('2026-01-01Z'), startDate: new Date('2026-01-01Z'),
    salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR,
    effectiveFrom: new Date('2026-01-01Z'), createdById: creatorId,
  } });
}

async function main() {
  ok(calculateMonthlyCompensationBase({ baseRate: new Prisma.Decimal(30000), payFrequency: PayFrequency.MONTHLY, periodStart: new Date('2026-01-01Z'), periodEnd: new Date('2026-01-31Z') }).equals(30000), 'monthly rate resolves for an exact calendar-month period');
  ok(await rejected(async () => calculateMonthlyCompensationBase({ baseRate: new Prisma.Decimal(30000), payFrequency: PayFrequency.MONTHLY, periodStart: new Date('2026-01-01Z'), periodEnd: new Date('2026-01-15Z') }), 'SETUP_REQUIRED'), 'non-deterministic monthly period fails with SETUP_REQUIRED');
  const before = { attendance: await prisma.dailyAttendanceRecord.count(), leave: await prisma.leaveRequest.count(), employment: await prisma.employmentRecord.count() };
  try {
    await prisma.$transaction(async tx => {
      const marker = Date.now().toString(36);
      const org = await tx.organization.create({ data: { name: 'H6 Organization', slug: `h6-${marker}` } });
      const otherOrg = await tx.organization.create({ data: { name: 'H6 Other', slug: `h6-other-${marker}` } });
      const hr = await tx.user.create({ data: { organizationId: org.id, name: 'HR', email: `h6-hr-${marker}@example.test`, role: Role.HR_ADMIN } });
      const admin = await tx.user.create({ data: { organizationId: org.id, name: 'Admin', email: `h6-admin-${marker}@example.test`, role: Role.ORGANIZATION_ADMIN } });
      const manager = await tx.user.create({ data: { organizationId: org.id, name: 'Manager', email: `h6-manager-${marker}@example.test`, role: Role.HIRING_MANAGER } });
      const employeeUser = await tx.user.create({ data: { organizationId: org.id, name: 'Employee', email: `h6-employee-${marker}@example.test`, role: Role.EMPLOYEE } });
      const otherHr = await tx.user.create({ data: { organizationId: otherOrg.id, name: 'Other HR', email: `h6-other-hr-${marker}@example.test`, role: Role.HR_ADMIN } });
      const employee = await fixtureEmployee(tx, org.id, hr.id, marker);
      const otherEmployee = await fixtureEmployee(tx, otherOrg.id, otherHr.id, `other-${marker}`);
      const base = { organizationId: org.id, employeeId: employee.id, compensationType: 'MONTHLY', baseRate: '30000.00', payFrequency: 'MONTHLY', currency: 'PHP', effectiveFrom: '2026-01-01' };

      const compensation = await createEmployeeCompensation({ ...base, actorUserId: hr.id }, tx);
      ok(Boolean(compensation.id), 'HR Admin can create compensation');
      const secondEmployee = await fixtureEmployee(tx, org.id, admin.id, `admin-${marker}`);
      ok(Boolean((await createEmployeeCompensation({ ...base, employeeId: secondEmployee.id, actorUserId: admin.id }, tx)).id), 'Organization Admin can create compensation');
      ok(await rejected(() => createEmployeeCompensation({ ...base, employeeId: otherEmployee.id, actorUserId: manager.id }, tx), 'FORBIDDEN'), 'Hiring Manager is denied');
      ok(await rejected(() => createEmployeeCompensation({ ...base, employeeId: otherEmployee.id, actorUserId: employeeUser.id }, tx), 'FORBIDDEN'), 'Employee is denied');
      ok(await rejected(() => createEmployeeCompensation({ ...base, employeeId: otherEmployee.id, actorUserId: hr.id }, tx), 'EMPLOYEE_NOT_FOUND'), 'employee must belong to organization');
      ok(await rejected(() => getCompensationById(otherOrg.id, compensation.id, tx), 'NOT_FOUND'), 'cross-tenant compensation access is denied');
      ok(await rejected(() => createEmployeeCompensation({ ...base, employeeId: otherEmployee.id, organizationId: otherOrg.id, actorUserId: otherHr.id, baseRate: '0' }, tx), 'INVALID_RATE'), 'invalid compensation rate is rejected');
      ok(await rejected(() => createEmployeeCompensation({ ...base, employeeId: otherEmployee.id, organizationId: otherOrg.id, actorUserId: otherHr.id, effectiveFrom: '2026-02-01', effectiveTo: '2026-01-31' }, tx), 'INVALID_DATE_RANGE'), 'invalid effective dates are rejected');
      ok(await rejected(() => createEmployeeCompensation({ ...base, actorUserId: hr.id, effectiveFrom: '2026-06-01' }, tx), 'OVERLAPPING_COMPENSATION'), 'overlapping compensation is rejected');

      const period = await createPayrollPeriod({ organizationId: org.id, actorUserId: hr.id, name: 'January 2026', periodStart: '2026-01-01', periodEnd: '2026-01-31', payDate: '2026-02-05' }, tx);
      ok(period.status === 'DRAFT', 'payroll period creation works with DRAFT status');
      ok(await rejected(() => createPayrollPeriod({ organizationId: org.id, actorUserId: hr.id, name: 'Invalid', periodStart: '2026-03-10', periodEnd: '2026-03-01', payDate: '2026-03-15' }, tx), 'INVALID_DATE_RANGE'), 'invalid payroll period dates are rejected');
      ok(await rejected(() => getPayrollPeriodById(otherOrg.id, period.id, tx), 'NOT_FOUND'), 'cross-tenant payroll period access is denied');
      ok((await tx.payrollPeriod.count({ where: { organizationId: org.id } })) === 1 && (await tx.payrollPeriod.count({ where: { organizationId: otherOrg.id } })) === 0, 'payroll data belongs to its organization');
      ok(await rejected(() => createPayrollPeriod({ organizationId: org.id, actorUserId: hr.id, name: 'Overlap', periodStart: '2026-01-15', periodEnd: '2026-02-15', payDate: '2026-02-20' }, tx), 'OVERLAPPING_PERIOD'), 'overlapping payroll periods are rejected');

      const missingEmployee = await fixtureEmployee(tx, org.id, hr.id, `missing-${marker}`);
      const dailyEmployee = await fixtureEmployee(tx, org.id, hr.id, `daily-${marker}`);
      const monthlyEmployment = await fixtureEmployment(tx, employee.id, hr.id, `monthly-${marker}`);
      await fixtureEmployment(tx, secondEmployee.id, hr.id, `second-${marker}`);
      const dailyEmployment = await fixtureEmployment(tx, dailyEmployee.id, hr.id, `daily-${marker}`);
      await createEmployeeCompensation({ ...base, actorUserId: hr.id, employeeId: dailyEmployee.id, compensationType: 'DAILY', baseRate: '1000.00', payFrequency: 'MONTHLY' }, tx);

      const attendanceRows = Array.from({ length: 31 }, (_, index) => {
        const attendanceDate = new Date(Date.UTC(2026, 0, index + 1));
        const weekday = attendanceDate.getUTCDay();
        const isWorkday = weekday !== 0 && weekday !== 6;
        return {
          organizationId: org.id, employeeId: dailyEmployee.id, employmentRecordId: dailyEmployment.id,
          attendanceDate, timeZoneSnapshot: 'UTC', attendanceStatus: isWorkday ? AttendanceStatus.PRESENT : AttendanceStatus.REST_DAY,
          disposition: AttendanceDisposition.NORMAL, lastCalculatedAt: new Date('2026-02-01Z'), finalizedAt: new Date('2026-02-01Z'),
        };
      });
      await tx.dailyAttendanceRecord.createMany({ data: attendanceRows });
      await tx.dailyAttendanceRecord.update({ where: { organizationId_employeeId_attendanceDate: { organizationId: org.id, employeeId: dailyEmployee.id, attendanceDate: new Date('2026-01-05Z') } }, data: { attendanceStatus: AttendanceStatus.ABSENT, lateSeconds: 600, disposition: AttendanceDisposition.APPROVED_LEAVE } });

      const leaveType = await tx.leaveType.create({ data: { organizationId: org.id, code: `H6-${marker}`, name: 'H6 Test Leave', isPaid: true, countingMode: LeaveCountingMode.SCHEDULED_WORK_DAYS, policyReference: 'H6.2 test fixture' } });
      const leaveRequest = await tx.leaveRequest.create({ data: {
        organizationId: org.id, employeeId: dailyEmployee.id, leaveTypeId: leaveType.id,
        requestedStartDate: new Date('2026-01-05Z'), requestedEndDate: new Date('2026-01-05Z'), requestedUnits: 1,
        calculationFinalizedAt: new Date('2026-01-01Z'), reason: 'H6 summary fixture', status: LeaveRequestStatus.APPROVED,
        policySnapshot: {}, leaveTypeCodeSnapshot: leaveType.code, leaveTypeNameSnapshot: leaveType.name,
        leavePaidSnapshot: true, countingModeSnapshot: LeaveCountingMode.SCHEDULED_WORK_DAYS,
      } });
      await tx.leaveRequestDay.create({ data: {
        organizationId: org.id, leaveRequestId: leaveRequest.id, employeeId: dailyEmployee.id,
        attendanceDate: new Date('2026-01-05Z'), employmentRecordId: dailyEmployment.id, isScheduledWorkday: true,
        scheduledStartSecond: 28800, scheduledEndSecond: 61200, scheduledNetSeconds: 32400, chargeUnits: 1,
        employmentSnapshot: { employmentRecordId: dailyEmployment.id },
      } });

      ok(await rejected(() => generatePayroll({ organizationId: org.id, actorUserId: manager.id, payrollPeriodId: period.id }, tx), 'FORBIDDEN'), 'Hiring Manager cannot generate payroll');
      ok(await rejected(() => generatePayroll({ organizationId: otherOrg.id, actorUserId: otherHr.id, payrollPeriodId: period.id }, tx), 'NOT_FOUND'), 'cross-tenant payroll generation is blocked');
      const generated = await generatePayroll({ organizationId: org.id, actorUserId: hr.id, payrollPeriodId: period.id }, tx);
      ok(generated.createdCount === 3 && generated.setupErrors.some(error => error.employeeId === missingEmployee.id), 'generation creates eligible entries and reports missing compensation safely');
      const monthlyEntry = await tx.payrollEntry.findUniqueOrThrow({ where: { organizationId_payrollPeriodId_employeeId: { organizationId: org.id, payrollPeriodId: period.id, employeeId: employee.id } } });
      const dailyEntry = await tx.payrollEntry.findUniqueOrThrow({ where: { organizationId_payrollPeriodId_employeeId: { organizationId: org.id, payrollPeriodId: period.id, employeeId: dailyEmployee.id } } });
      const monthlySnapshot = monthlyEntry.calculationSnapshot as { compensation: { id: string; type: string }; policy: { id: string; version: number; dailyPayBasis: string; deductionRules: { late: { rule: string }; absence: { rule: string }; undertime: { rule: string } } }; calculation: { baseAmount: string; grossAmount: string; totalDeductions: string; netAmount: string } };
      const dailySnapshot = dailyEntry.calculationSnapshot as { calculation: { payableWorkdays: number }; attendanceSummary: { absentDays: number; lateOccurrences: number }; leaveSummary: { approvedDays: number; approvedUnits: string } };
      ok(monthlyEntry.employeeCompensationId === compensation.id && monthlySnapshot.compensation.id === compensation.id, 'generation resolves and snapshots the unique active compensation');
      ok(monthlyEntry.baseAmount.equals(30000) && monthlySnapshot.compensation.type === CompensationType.MONTHLY, 'monthly payroll calculation uses the exact monthly period rate');
      ok(dailySnapshot.calculation.payableWorkdays === 22 && dailyEntry.baseAmount.equals(22000), 'daily payroll counts scheduled workdays and excludes rest days');
      ok(dailySnapshot.attendanceSummary.absentDays === 0 && dailySnapshot.attendanceSummary.lateOccurrences === 1, 'attendance summary reports late and excludes approved leave from absence');
      ok(dailySnapshot.leaveSummary.approvedDays === 1 && dailySnapshot.leaveSummary.approvedUnits === '1.0000', 'approved H5 leave is summarized');
      ok(monthlyEntry.totalDeductions.isZero() && monthlyEntry.netAmount.equals(monthlyEntry.grossAmount) && monthlySnapshot.calculation.totalDeductions === '0.00' && monthlySnapshot.calculation.netAmount === monthlySnapshot.calculation.grossAmount, 'deductions remain zero and net equals gross');
      ok(monthlySnapshot.policy.id === 'DEFAULT' && monthlySnapshot.policy.version === 0 && monthlySnapshot.policy.dailyPayBasis === DailyPayBasis.SCHEDULED_PAYABLE_DAYS && monthlySnapshot.policy.deductionRules.late.rule === 'NONE', 'default policy preserves H6.2 calculation behavior and is fully snapshotted');

      const studyType = await tx.leaveType.create({ data: { organizationId: org.id, code: 'STUDY', name: 'Study Leave', isPaid: false, countingMode: LeaveCountingMode.CALENDAR_DAYS, policyReference: 'SAGA manual: without pay' } });
      const policyBase = {
        organizationId: org.id, dailyPayBasis: 'SCHEDULED_PAYABLE_DAYS', lateDeductionRule: 'NONE', lateDeductionParameter: null,
        absenceDeductionRule: 'NONE', absenceDeductionParameter: null, undertimeDeductionRule: 'NONE', undertimeDeductionParameter: null,
        roundingRule: 'STANDARD_2_DECIMAL', leaveTreatments: [] as Array<{ leaveTypeId: string; treatment: string }>,
      };
      const policy1 = await createPayrollPolicy({ ...policyBase, actorUserId: hr.id, effectiveFrom: '2027-01-01', effectiveTo: '2027-12-31' }, tx);
      ok(policy1.version === 1, 'HR Admin can create the first effective-dated payroll policy version');
      const policy2 = await createPayrollPolicy({ ...policyBase, actorUserId: admin.id, effectiveFrom: '2028-01-01', effectiveTo: '2028-12-31', dailyPayBasis: 'ACTUAL_PRESENT_DAYS' }, tx);
      ok(policy2.version === 2, 'Organization Admin can create the next payroll policy version');
      ok(await rejected(() => createPayrollPolicy({ ...policyBase, actorUserId: manager.id, effectiveFrom: '2031-01-01' }, tx), 'FORBIDDEN'), 'Hiring Manager cannot create payroll policy');
      ok(await rejected(() => createPayrollPolicy({ ...policyBase, actorUserId: employeeUser.id, effectiveFrom: '2031-01-01' }, tx), 'FORBIDDEN'), 'Employee cannot create payroll policy');
      ok(await rejected(() => getPayrollPolicyById(otherOrg.id, policy1.id, tx), 'NOT_FOUND'), 'cross-tenant payroll policy access is denied');
      ok(await rejected(() => createPayrollPolicy({ ...policyBase, actorUserId: hr.id, effectiveFrom: '2031-01-01', lateDeductionRule: 'PER_MINUTE', lateDeductionParameter: '0' }, tx), 'INVALID_PARAMETER'), 'invalid deduction parameter is rejected');
      const resolved2027 = await resolvePayrollPolicy(org.id, new Date('2027-02-01Z'), new Date('2027-02-28Z'), tx);
      const resolved2028 = await resolvePayrollPolicy(org.id, new Date('2028-02-01Z'), new Date('2028-02-29Z'), tx);
      ok(resolved2027.version === 1 && resolved2028.version === 2 && resolved2028.dailyPayBasis === DailyPayBasis.ACTUAL_PRESENT_DAYS, 'policy version resolution follows effective dating');
      const studyTreatment = policy1.leaveTreatments.find(item => item.leaveTypeId === studyType.id);
      ok(studyTreatment?.treatment === LeavePayrollTreatment.UNPAID, 'SAGA Study Leave is automatically configured as UNPAID');
      ok(await rejected(() => createPayrollPolicy({ ...policyBase, actorUserId: hr.id, effectiveFrom: '2031-01-01', leaveTreatments: [{ leaveTypeId: studyType.id, treatment: 'PAID' }] }, tx), 'INVALID_POLICY'), 'SAGA Study Leave cannot be configured as paid');
      const policyPeriod = await createPayrollPeriod({ organizationId: org.id, actorUserId: hr.id, name: 'January 2027', periodStart: '2027-01-01', periodEnd: '2027-01-31', payDate: '2027-02-05' }, tx);
      await generatePayroll({ organizationId: org.id, actorUserId: hr.id, payrollPeriodId: policyPeriod.id }, tx);
      const policyEntry = await tx.payrollEntry.findUniqueOrThrow({ where: { organizationId_payrollPeriodId_employeeId: { organizationId: org.id, payrollPeriodId: policyPeriod.id, employeeId: employee.id } } });
      const policyEntrySnapshot = policyEntry.calculationSnapshot as { policy: { id: string; version: number; effectiveFrom: string } };
      ok(policyEntrySnapshot.policy.id === policy1.id && policyEntrySnapshot.policy.version === 1 && policyEntrySnapshot.policy.effectiveFrom === '2027-01-01', 'payroll snapshot stores the resolved custom policy id, version, and effective date');
      ok(JSON.stringify((await tx.payrollEntry.findUniqueOrThrow({ where: { id: monthlyEntry.id } })).calculationSnapshot) === JSON.stringify(monthlyEntry.calculationSnapshot), 'future policy changes do not mutate an existing payroll snapshot');

      await tx.organizationPayrollPolicy.create({ data: {
        organizationId: org.id, version: 3, effectiveFrom: new Date('2029-01-01Z'),
        dailyPayBasis: DailyPayBasis.SCHEDULED_PAYABLE_DAYS, lateDeductionRule: LateDeductionRule.PER_MINUTE,
        lateDeductionParameter: null, absenceDeductionRule: 'NONE', undertimeDeductionRule: 'NONE',
        roundingRule: PayrollRoundingRule.STANDARD_2_DECIMAL, createdById: hr.id,
      } });
      const malformedPeriod = await createPayrollPeriod({ organizationId: org.id, actorUserId: hr.id, name: 'January 2029', periodStart: '2029-01-01', periodEnd: '2029-01-31', payDate: '2029-02-05' }, tx);
      ok(await rejected(() => generatePayroll({ organizationId: org.id, actorUserId: hr.id, payrollPeriodId: malformedPeriod.id }, tx), 'SETUP_REQUIRED'), 'missing required policy parameter stops payroll with SETUP_REQUIRED');
      await tx.organizationPayrollPolicy.update({ where: { organizationId_version: { organizationId: org.id, version: 3 } }, data: { effectiveTo: new Date('2029-12-31Z') } });

      ok(await rejected(() => movePayrollPeriodToReview({ organizationId: org.id, actorUserId: manager.id, payrollPeriodId: period.id }, tx), 'FORBIDDEN'), 'Hiring Manager cannot move payroll to review');
      ok(await rejected(() => movePayrollPeriodToReview({ organizationId: org.id, actorUserId: employeeUser.id, payrollPeriodId: period.id }, tx), 'FORBIDDEN'), 'Employee cannot move payroll to review');
      const reviewPeriod = await movePayrollPeriodToReview({ organizationId: org.id, actorUserId: hr.id, payrollPeriodId: period.id }, tx);
      ok(reviewPeriod.status === 'REVIEW', 'HR Admin can move a generated payroll period to review');
      const blockedReview = await assessPayrollPeriod(org.id, period.id, tx);
      ok(blockedReview.summary.setupRequired > 0 && blockedReview.issues.some(issue => issue.employeeId === missingEmployee.id), 'missing eligible employee is reported as unresolved SETUP_REQUIRED');
      ok(await rejected(() => finalizePayrollPeriod({ organizationId: org.id, actorUserId: admin.id, payrollPeriodId: period.id, confirmation: 'FINALIZE' }, tx), 'FINALIZATION_BLOCKED'), 'unresolved setup entry blocks finalization');
      ok(await rejected(() => finalizePayrollPeriod({ organizationId: otherOrg.id, actorUserId: otherHr.id, payrollPeriodId: period.id, confirmation: 'FINALIZE' }, tx), 'NOT_FOUND'), 'cross-tenant finalization is denied');
      ok(await rejected(() => finalizePayrollPeriod({ organizationId: org.id, actorUserId: admin.id, payrollPeriodId: period.id, confirmation: '' }, tx), 'CONFIRMATION_REQUIRED'), 'finalization requires explicit confirmation');

      await createEmployeeCompensation({ ...base, actorUserId: hr.id, employeeId: missingEmployee.id }, tx);
      const reconciled = await generatePayroll({ organizationId: org.id, actorUserId: hr.id, payrollPeriodId: period.id }, tx);
      ok(reconciled.createdCount === 1 && await tx.payrollEntry.count({ where: { organizationId: org.id, payrollPeriodId: period.id } }) === 4, 'generation reconciles the missing eligible employee without duplicates');
      const originalDailySnapshot = dailyEntry.calculationSnapshot;
      await tx.payrollEntry.update({ where: { id: dailyEntry.id }, data: { calculationSnapshot: { broken: true } } });
      const errorReview = await assessPayrollPeriod(org.id, period.id, tx);
      ok(errorReview.summary.errors > 0 && errorReview.issues.some(issue => issue.employeeId === dailyEmployee.id && issue.kind === 'CALCULATION_ERROR'), 'calculation error is identified during review');
      ok(await rejected(() => finalizePayrollPeriod({ organizationId: org.id, actorUserId: admin.id, payrollPeriodId: period.id, confirmation: 'FINALIZE' }, tx), 'FINALIZATION_BLOCKED'), 'calculation error blocks finalization');
      await tx.payrollEntry.update({ where: { id: dailyEntry.id }, data: { calculationSnapshot: originalDailySnapshot! } });

      const readyReview = await assessPayrollPeriod(org.id, period.id, tx);
      ok(readyReview.canFinalize && readyReview.summary.ready === 4 && readyReview.summary.setupRequired === 0 && readyReview.summary.errors === 0, 'all eligible employees and valid snapshots make review eligible for finalization');
      ok(readyReview.totals.employeeCount === 4 && readyReview.totals.gross === '112000.00' && readyReview.totals.deductions === '0.00' && readyReview.totals.net === '112000.00', 'period totals equal the real payroll entry totals');
      ok(await rejected(() => finalizePayrollPeriod({ organizationId: org.id, actorUserId: manager.id, payrollPeriodId: period.id, confirmation: 'FINALIZE' }, tx), 'FORBIDDEN'), 'Hiring Manager cannot finalize payroll');
      ok(await rejected(() => finalizePayrollPeriod({ organizationId: org.id, actorUserId: employeeUser.id, payrollPeriodId: period.id, confirmation: 'FINALIZE' }, tx), 'FORBIDDEN'), 'Employee cannot finalize payroll');
      const snapshotBefore = JSON.stringify(monthlyEntry.calculationSnapshot);
      const finalized = await finalizePayrollPeriod({ organizationId: org.id, actorUserId: admin.id, payrollPeriodId: period.id, confirmation: 'FINALIZE' }, tx);
      ok(finalized.status === 'FINALIZED' && finalized.finalizedById === admin.id && finalized.finalizedAt instanceof Date, 'Organization Admin finalizes valid payroll with finalizedBy and finalizedAt');
      ok((await tx.payrollEntry.count({ where: { organizationId: org.id, payrollPeriodId: period.id, status: PayrollEntryStatus.FINALIZED } })) === 4, 'valid finalization locks every payroll entry');
      ok(await rejected(() => generatePayroll({ organizationId: org.id, actorUserId: admin.id, payrollPeriodId: period.id }, tx), 'FINALIZED'), 'regeneration after finalization is rejected');
      await tx.$executeRawUnsafe('SAVEPOINT h6_finalized_entry_update');
      let updateBlocked = false;
      try { await tx.payrollEntry.update({ where: { id: monthlyEntry.id }, data: { netAmount: 1 } }); } catch { updateBlocked = true; await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT h6_finalized_entry_update'); }
      await tx.$executeRawUnsafe('SAVEPOINT h6_finalized_entry_delete');
      let deleteBlocked = false;
      try { await tx.payrollEntry.delete({ where: { id: monthlyEntry.id } }); } catch { deleteBlocked = true; await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT h6_finalized_entry_delete'); }
      ok(updateBlocked && deleteBlocked, 'database guards reject editing or deleting finalized payroll entries');
      await tx.employeeCompensation.create({ data: { organizationId: org.id, employeeId: employee.id, compensationType: CompensationType.MONTHLY, baseRate: 99999, payFrequency: PayFrequency.MONTHLY, currency: 'PHP', effectiveFrom: new Date('2030-01-01Z') } });
      await createPayrollPolicy({ ...policyBase, actorUserId: admin.id, effectiveFrom: '2030-01-01', effectiveTo: '2030-12-31' }, tx);
      const afterChanges = await tx.payrollEntry.findUniqueOrThrow({ where: { id: monthlyEntry.id } });
      ok(JSON.stringify(afterChanges.calculationSnapshot) === snapshotBefore && afterChanges.employeeCompensationId === compensation.id, 'later compensation and policy changes do not alter finalized payroll references or snapshots');

      await tx.employeeAccount.create({ data: { organizationId: org.id, userId: employeeUser.id, employeeId: employee.id, status: EmployeeAccountStatus.ACTIVE, activatedAt: new Date(), createdById: hr.id } });
      const hrPayslip = await getFinalizedPayslipForAdmin({ organizationId: org.id, actorUserId: hr.id, entryId: monthlyEntry.id }, tx);
      const adminPayslip = await getFinalizedPayslipForAdmin({ organizationId: org.id, actorUserId: admin.id, entryId: monthlyEntry.id }, tx);
      ok(hrPayslip.entryId === monthlyEntry.id, 'HR Admin can view a finalized employee payslip');
      ok(adminPayslip.entryId === monthlyEntry.id, 'Organization Admin can view a finalized employee payslip');
      ok(await rejected(() => getFinalizedPayslipForAdmin({ organizationId: org.id, actorUserId: manager.id, entryId: monthlyEntry.id }, tx), 'FORBIDDEN'), 'Hiring Manager cannot view payroll payslips');
      ok(await rejected(() => getFinalizedPayslipForAdmin({ organizationId: otherOrg.id, actorUserId: otherHr.id, entryId: monthlyEntry.id }, tx), 'NOT_FOUND'), 'cross-tenant finalized payslip access is denied');
      const ownPayslip = await getFinalizedPayslipForEmployee({ organizationId: org.id, userId: employeeUser.id, entryId: monthlyEntry.id }, tx);
      ok(ownPayslip.employee.employeeNumber === employee.employeeNumber, 'employee can view their own finalized payslip through the active linked account');
      ok(await rejected(() => getFinalizedPayslipForEmployee({ organizationId: org.id, userId: employeeUser.id, entryId: dailyEntry.id }, tx), 'NOT_FOUND'), 'employee cannot view another employee payslip by changing the entry ID');
      ok(ownPayslip.calculation.basePay === monthlySnapshot.calculation.baseAmount && ownPayslip.calculation.grossPay === monthlySnapshot.calculation.grossAmount && ownPayslip.calculation.netPay === monthlySnapshot.calculation.netAmount, 'payslip values equal the authoritative finalized snapshot');
      ok(ownPayslip.payroll.compensationRate === '30000.00' && ownPayslip.payroll.compensationType === CompensationType.MONTHLY, 'later compensation and policy changes do not alter finalized payslip details');

      const draftPeriod = await tx.payrollPeriod.create({ data: { organizationId: org.id, name: 'Draft ESS hidden', periodStart: new Date('2032-01-01Z'), periodEnd: new Date('2032-01-31Z'), payDate: new Date('2032-02-05Z') } });
      const reviewOnlyPeriod = await tx.payrollPeriod.create({ data: { organizationId: org.id, name: 'Review ESS hidden', periodStart: new Date('2033-01-01Z'), periodEnd: new Date('2033-01-31Z'), payDate: new Date('2033-02-05Z'), status: PayrollPeriodStatus.REVIEW } });
      await tx.payrollEntry.create({ data: { organizationId: org.id, payrollPeriodId: draftPeriod.id, employeeId: employee.id, employeeCompensationId: compensation.id, baseAmount: 1, grossAmount: 1, netAmount: 1, calculationSnapshot: monthlyEntry.calculationSnapshot! } });
      await tx.payrollEntry.create({ data: { organizationId: org.id, payrollPeriodId: reviewOnlyPeriod.id, employeeId: employee.id, employeeCompensationId: compensation.id, baseAmount: 1, grossAmount: 1, netAmount: 1, status: PayrollEntryStatus.REVIEW, calculationSnapshot: monthlyEntry.calculationSnapshot! } });
      const essList = await listFinalizedPayslipsForEmployee({ organizationId: org.id, userId: employeeUser.id }, tx);
      ok(essList.length === 1 && essList[0].entryId === monthlyEntry.id, 'ESS hides draft and review payroll while showing finalized payroll');
      const safePrintModel = JSON.stringify(ownPayslip);
      ok(!safePrintModel.includes('calculationSnapshot') && !safePrintModel.includes('employeeCompensationId') && !safePrintModel.includes('createdById') && !safePrintModel.includes('organizationId'), 'print payslip model exposes no raw snapshot or private internal fields');
      ok(monthlyEmployment.employeeId === employee.id && (await tx.dailyAttendanceRecord.count()) === before.attendance + 31 && (await tx.leaveRequest.count()) === before.leave + 1 && (await tx.employmentRecord.count()) === before.employment + 3, 'H3 and H5 source records are read without mutation');
      throw rollback;
    }, { timeout: 120_000 });
  } catch (error) { if (error !== rollback) throw error; }
  ok((await prisma.organization.count({ where: { slug: { startsWith: 'h6-' } } })) === 0, 'H6 fixtures roll back cleanly');
  console.log(`H6.4/H6.5 Payslip & ESS Payroll integration tests passed: ${assertions} assertions.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

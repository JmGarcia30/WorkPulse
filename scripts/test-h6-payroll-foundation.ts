import { ApplicationStatus, EmploymentCategory, JobStatus, PrismaClient, Role } from '@prisma/client';
import { createEmployeeCompensation, createPayrollPeriod, getCompensationById, getPayrollPeriodById } from '../src/features/payroll/service';

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

async function main() {
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
      const entry = await tx.payrollEntry.create({ data: { organizationId: org.id, payrollPeriodId: period.id, employeeId: employee.id, employeeCompensationId: compensation.id } });
      ok(entry.baseAmount.isZero() && entry.status === 'DRAFT', 'PayrollEntry foundation is calculation-neutral');
      ok((await tx.dailyAttendanceRecord.count()) === before.attendance && (await tx.leaveRequest.count()) === before.leave && (await tx.employmentRecord.count()) === before.employment, 'existing H1-H5 records remain unaffected');
      throw rollback;
    }, { timeout: 120_000 });
  } catch (error) { if (error !== rollback) throw error; }
  ok((await prisma.organization.count({ where: { slug: { startsWith: 'h6-' } } })) === 0, 'H6 fixtures roll back cleanly');
  console.log(`H6.1 Payroll Foundation integration tests passed: ${assertions} assertions.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

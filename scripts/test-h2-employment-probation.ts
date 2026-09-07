import { prisma } from '../src/lib/db/prisma';
import {
  ApplicationStatus,
  EmployeeStatus,
  EmploymentCategory,
  EmploymentStatus,
  JobStatus,
  PayFrequency,
  ProbationDecision,
  Role,
} from '@prisma/client';
import {
  deriveProbationReviewState,
  parseInstitutionalDate,
} from '../src/features/employees/domain';
import {
  doNotRenewEmployee,
  EmploymentLifecycleError,
  regularizeEmployee,
  renewTeachingProbation,
} from '../src/features/employees/lifecycle';
import { getOrganizationEmployeeById } from '../src/features/employees/queries';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function createEmployee(input: {
  organizationId: string;
  actorUserId: string;
  category: EmploymentCategory;
  suffix: string;
  startedAt: Date;
  expectedEndAt: Date;
}) {
  const job = await prisma.job.create({
    data: {
      organizationId: input.organizationId,
      title: `H2 ${input.suffix}`,
      slug: `h2-${input.suffix}`,
      department: input.category === EmploymentCategory.TEACHING ? 'Academics' : 'Administration',
      employmentType: 'Full-Time',
      location: 'Campus',
      description: 'H2 fixture',
      responsibilities: 'H2 fixture',
      qualifications: 'H2 fixture',
      requirements: 'H2 fixture',
      category: input.category,
      status: JobStatus.CLOSED,
    },
  });
  const applicant = await prisma.applicant.create({
    data: {
      firstName: input.suffix,
      lastName: 'H2 Test',
      email: `${input.suffix}@h2.test`,
      phone: '09170000000',
    },
  });
  const application = await prisma.application.create({
    data: {
      jobId: job.id,
      applicantId: applicant.id,
      status: ApplicationStatus.HIRED,
      coverLetter: 'H2 lifecycle fixture',
    },
  });
  const employee = await prisma.employee.create({
    data: {
      organizationId: input.organizationId,
      sourceApplicationId: application.id,
      applicantId: applicant.id,
      employeeNumber: `H2-${input.suffix}`,
      firstName: input.suffix,
      lastName: 'H2 Test',
      email: applicant.email,
      phone: applicant.phone,
      createdById: input.actorUserId,
    },
  });
  const employment = await prisma.employmentRecord.create({
    data: {
      employeeId: employee.id,
      jobId: job.id,
      jobTitle: job.title,
      department: job.department,
      employmentCategory: input.category,
      employmentType: 'Full-Time',
      hireDate: input.startedAt,
      startDate: input.startedAt,
      salary: 35_000,
      payFrequency: PayFrequency.MONTHLY,
      effectiveFrom: input.startedAt,
      createdById: input.actorUserId,
      probation: {
        create: {
          employeeId: employee.id,
          category: input.category,
          startedAt: input.startedAt,
          expectedEndAt: input.expectedEndAt,
          maxRenewals: input.category === EmploymentCategory.TEACHING ? 2 : 0,
          policySnapshot: 'H2 SAGA test policy snapshot',
        },
      },
    },
  });
  return { employee, employment, applicant };
}

async function main() {
  const marker = `h2-${Date.now()}`;
  const organization = await prisma.organization.create({
    data: { name: 'H2 Employment Test Organization', slug: marker },
  });
  const actor = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'H2 HR',
      email: `${marker}@h2.test`,
      passwordHash: 'test-only',
      role: Role.HR_ADMIN,
    },
  });
  const applicantIds: string[] = [];

  try {
    assert(parseInstitutionalDate('2026-02-28', 'Date').getUTCDate() === 28, 'strict date parsing succeeds');
    let invalidDateRejected = false;
    try { parseInstitutionalDate('2026-02-30', 'Date'); } catch { invalidDateRejected = true; }
    assert(invalidDateRejected, 'invalid strict date is rejected');
    assert(deriveProbationReviewState({ probationStatus: 'ACTIVE', expectedEndAt: new Date('2026-09-27Z'), asOf: new Date('2026-09-07Z') }).state === 'ENDING_SOON', '30-day window derives Ending Soon');
    assert(deriveProbationReviewState({ probationStatus: 'ACTIVE', expectedEndAt: new Date('2026-09-07Z'), asOf: new Date('2026-09-07Z') }).state === 'REVIEW_DUE', 'same day derives Review Due');
    assert(deriveProbationReviewState({ probationStatus: 'ACTIVE', expectedEndAt: new Date('2026-09-06Z'), asOf: new Date('2026-09-07Z') }).state === 'OVERDUE_FOR_REVIEW', 'past date derives overdue without mutation');

    const staff = await createEmployee({ organizationId: organization.id, actorUserId: actor.id, category: EmploymentCategory.NON_TEACHING, suffix: 'staff', startedAt: new Date('2025-01-01Z'), expectedEndAt: new Date('2025-07-01Z') });
    applicantIds.push(staff.applicant.id);
    let earlyRejected = false;
    try {
      await regularizeEmployee({ employeeId: staff.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, regularizationEffectiveAt: new Date('2025-07-01Z'), decisionAt: new Date('2025-06-30T12:00:00Z') });
    } catch (error) { earlyRejected = error instanceof EmploymentLifecycleError && error.code === 'NOT_YET_ELIGIBLE'; }
    assert(earlyRejected, 'regularization before eligibility is rejected');
    await regularizeEmployee({ employeeId: staff.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, regularizationEffectiveAt: new Date('2025-07-01Z'), decisionAt: new Date('2025-07-05T12:00:00Z'), remarks: 'Satisfactory completion' });
    const regularized = await prisma.employee.findUniqueOrThrow({ where: { id: staff.employee.id }, include: { employmentRecords: { orderBy: { effectiveFrom: 'asc' }, include: { probation: true } }, employmentDecisions: true } });
    assert(regularized.employmentRecords.length === 2 && regularized.employmentRecords[1].employmentStatus === EmploymentStatus.REGULAR, 'regularization creates a regular successor');
    assert(regularized.employmentRecords[0].effectiveTo?.toISOString() === '2025-07-01T00:00:00.000Z', 'regularization uses institutional effective date');
    assert(regularized.employmentDecisions[0].decisionAt.toISOString() === '2025-07-05T12:00:00.000Z', 'decision timestamp remains distinct');

    const teacher = await createEmployee({ organizationId: organization.id, actorUserId: actor.id, category: EmploymentCategory.TEACHING, suffix: 'teacher', startedAt: new Date('2025-09-08Z'), expectedEndAt: new Date('2026-09-07Z') });
    applicantIds.push(teacher.applicant.id);
    await renewTeachingProbation({ employeeId: teacher.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, nextSchoolYearStartDate: new Date('2026-09-08Z'), nextSchoolYearEndDate: new Date('2027-09-07Z'), decisionAt: new Date('2026-09-07T09:00:00Z') });
    let sameDayRetryRejected = false;
    try { await renewTeachingProbation({ employeeId: teacher.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, nextSchoolYearStartDate: new Date('2026-09-08Z'), nextSchoolYearEndDate: new Date('2027-09-07Z'), decisionAt: new Date('2026-09-07T10:00:00Z') }); } catch (error) { sameDayRetryRejected = error instanceof EmploymentLifecycleError && error.code === 'ALREADY_DECIDED'; }
    assert(sameDayRetryRejected, 'repeated same-day future renewal is rejected safely');
    const afterRetry = await prisma.employee.findUniqueOrThrow({ where: { id: teacher.employee.id }, include: { probationRecords: true, employmentRecords: true } });
    assert(afterRetry.probationRecords.length === 2 && afterRetry.employmentRecords.length === 2, 'same-day retry creates no duplicate successor records');
    await renewTeachingProbation({ employeeId: teacher.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, nextSchoolYearStartDate: new Date('2027-09-08Z'), nextSchoolYearEndDate: new Date('2028-09-07Z'), decisionAt: new Date('2027-09-07T09:00:00Z') });
    const renewed = await prisma.employee.findUniqueOrThrow({ where: { id: teacher.employee.id }, include: { probationRecords: { orderBy: { renewalCount: 'asc' } }, employmentRecords: true, employmentDecisions: true } });
    assert(renewed.probationRecords.length === 3, 'each Teaching school year has its own probation record');
    assert(renewed.probationRecords[1].startedAt.toISOString() === '2026-09-08T00:00:00.000Z' && renewed.probationRecords[1].expectedEndAt.toISOString() === '2027-09-07T00:00:00.000Z', 'future successor dates are preserved exactly');
    assert(renewed.employmentDecisions[0].decisionAt.toISOString() === '2026-09-07T09:00:00.000Z' && renewed.employmentDecisions[0].effectiveAt.toISOString() === '2026-09-08T00:00:00.000Z', 'renewal decision and future effective date remain distinct');
    assert(renewed.probationRecords[2].renewalCount === 2 && renewed.probationRecords[2].startedAt.toISOString() === '2027-09-08T00:00:00.000Z', 'second renewal preserves explicit dates and count');
    let facultyRegularizationRejected = false;
    try { await regularizeEmployee({ employeeId: teacher.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, regularizationEffectiveAt: new Date('2028-09-07Z'), decisionAt: new Date('2028-09-08Z') }); } catch (error) { facultyRegularizationRejected = error instanceof EmploymentLifecycleError && error.code === 'INVALID_STATE'; }
    assert(facultyRegularizationRejected, 'H2 rejects Faculty regularization');
    let thirdRejected = false;
    try { await renewTeachingProbation({ employeeId: teacher.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, nextSchoolYearStartDate: new Date('2028-09-08Z'), nextSchoolYearEndDate: new Date('2029-09-07Z'), decisionAt: new Date('2028-09-07Z') }); } catch (error) { thirdRejected = error instanceof EmploymentLifecycleError && error.code === 'MAX_RENEWALS_REACHED'; }
    assert(thirdRejected, 'renewal beyond maximum is rejected');

    const notRenewedFixture = await createEmployee({ organizationId: organization.id, actorUserId: actor.id, category: EmploymentCategory.NON_TEACHING, suffix: 'not-renewed', startedAt: new Date('2025-01-01Z'), expectedEndAt: new Date('2025-07-01Z') });
    applicantIds.push(notRenewedFixture.applicant.id);
    const attempts = await Promise.allSettled([1, 2].map(() => doNotRenewEmployee({ employeeId: notRenewedFixture.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, nonRenewalEffectiveAt: new Date('2025-07-01Z'), decisionAt: new Date('2025-07-02T09:00:00Z'), remarks: 'Appointment will not be renewed.' })));
    assert(attempts.filter((result) => result.status === 'fulfilled').length === 1, 'concurrent non-renewal has exactly one winner');
    const inactive = await getOrganizationEmployeeById(organization.id, notRenewedFixture.employee.id);
    assert(inactive?.employeeStatus === EmployeeStatus.INACTIVE, 'not renewed marks employee inactive');
    assert(inactive?.employmentRecords[0].effectiveTo?.toISOString() === '2025-07-01T00:00:00.000Z', 'not renewed closes employment on institutional date');
    assert(inactive?.statusHistory.some((entry) => entry.toStatus === EmployeeStatus.INACTIVE), 'not renewed records employee status history');
    assert(inactive?.employmentDecisions.length === 1 && inactive.employmentDecisions[0].decision === ProbationDecision.NOT_RENEWED, 'not renewed records one audit event');
    assert(await getOrganizationEmployeeById('wrong-tenant', staff.employee.id) === null, 'profile query remains tenant-isolated');

    const protectedFixture = await createEmployee({ organizationId: organization.id, actorUserId: actor.id, category: EmploymentCategory.NON_TEACHING, suffix: 'tenant-protected', startedAt: new Date('2025-01-01Z'), expectedEndAt: new Date('2025-07-01Z') });
    applicantIds.push(protectedFixture.applicant.id);
    let crossTenantRejected = false;
    try { await doNotRenewEmployee({ employeeId: protectedFixture.employee.id, organizationId: 'wrong-tenant', actorUserId: actor.id, confirmed: true, nonRenewalEffectiveAt: new Date('2025-07-01Z'), decisionAt: new Date('2025-07-02Z'), remarks: 'Cross-tenant attempt' }); } catch (error) { crossTenantRejected = error instanceof EmploymentLifecycleError && error.code === 'EMPLOYEE_NOT_FOUND'; }
    assert(crossTenantRejected, 'cross-tenant mutation is rejected');

    const rollbackFixture = await createEmployee({ organizationId: organization.id, actorUserId: actor.id, category: EmploymentCategory.NON_TEACHING, suffix: 'rollback', startedAt: new Date('2025-01-01Z'), expectedEndAt: new Date('2025-07-01Z') });
    applicantIds.push(rollbackFixture.applicant.id);
    const rollbackProbation = await prisma.probationRecord.findUniqueOrThrow({ where: { employmentRecordId: rollbackFixture.employment.id } });
    await prisma.employmentDecisionHistory.create({ data: { employeeId: rollbackFixture.employee.id, probationRecordId: rollbackProbation.id, previousEmploymentRecordId: rollbackFixture.employment.id, decision: ProbationDecision.NOT_RENEWED, decisionAt: new Date('2025-07-02Z'), effectiveAt: new Date('2025-07-01Z'), changedById: actor.id, remarks: 'Forced audit collision fixture', previousState: { probationStatus: 'ACTIVE' }, newState: { probationStatus: 'CLOSED' } } });
    let downstreamFailure = false;
    try { await doNotRenewEmployee({ employeeId: rollbackFixture.employee.id, organizationId: organization.id, actorUserId: actor.id, confirmed: true, nonRenewalEffectiveAt: new Date('2025-07-01Z'), decisionAt: new Date('2025-07-02Z'), remarks: 'Must roll back' }); } catch { downstreamFailure = true; }
    const rolledBack = await prisma.employee.findUniqueOrThrow({ where: { id: rollbackFixture.employee.id }, include: { employmentRecords: { include: { probation: true } } } });
    assert(downstreamFailure && rolledBack.employeeStatus === EmployeeStatus.ACTIVE && rolledBack.employmentRecords[0].effectiveTo === null && rolledBack.employmentRecords[0].probation?.decision === ProbationDecision.PENDING, 'downstream audit failure rolls back the complete decision');
    console.log('H2 Employment & Probation tests passed: 24 assertions.');
  } finally {
    await prisma.employmentDecisionHistory.deleteMany({ where: { employee: { organizationId: organization.id } } });
    await prisma.employeeStatusHistory.deleteMany({ where: { employee: { organizationId: organization.id } } });
    await prisma.probationRecord.deleteMany({ where: { employee: { organizationId: organization.id } } });
    await prisma.employmentRecord.deleteMany({ where: { employee: { organizationId: organization.id } } });
    await prisma.employee.deleteMany({ where: { organizationId: organization.id } });
    await prisma.application.deleteMany({ where: { job: { organizationId: organization.id } } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.applicant.deleteMany({ where: { id: { in: applicantIds } } });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());

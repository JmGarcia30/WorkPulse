import {
  EmployeeStatus,
  EmploymentCategory,
  EmploymentStatus,
  Prisma,
  ProbationDecision,
  ProbationStatus,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { addCalendarYearsClamped, utcStartOfDay } from './domain';

export type EmploymentLifecycleErrorCode =
  | 'EMPLOYEE_NOT_FOUND'
  | 'INVALID_STATE'
  | 'NOT_YET_ELIGIBLE'
  | 'INVALID_EFFECTIVE_DATE'
  | 'INVALID_PERIOD'
  | 'MAX_RENEWALS_REACHED'
  | 'CONFIRMATION_REQUIRED'
  | 'REMARKS_REQUIRED'
  | 'ALREADY_DECIDED';

export class EmploymentLifecycleError extends Error {
  constructor(
    public readonly code: EmploymentLifecycleErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'EmploymentLifecycleError';
  }
}

interface BaseLifecycleInput {
  employeeId: string;
  organizationId: string;
  actorUserId: string;
  confirmed: boolean;
  remarks?: string | null;
  decisionAt?: Date;
}

export interface RegularizeEmployeeInput extends BaseLifecycleInput {
  regularizationEffectiveAt: Date;
}

export interface RenewTeachingProbationInput extends BaseLifecycleInput {
  nextSchoolYearStartDate: Date;
  nextSchoolYearEndDate: Date;
}

export interface DoNotRenewEmployeeInput extends BaseLifecycleInput {
  nonRenewalEffectiveAt: Date;
}

export interface EmploymentLifecycleResult {
  employeeId: string;
  probationRecordId: string;
  employmentRecordId: string | null;
  decision: ProbationDecision;
}

const currentEmploymentInclude = {
  probation: true,
} satisfies Prisma.EmploymentRecordInclude;

type CurrentEmployment = Prisma.EmploymentRecordGetPayload<{
  include: typeof currentEmploymentInclude;
}>;

type LifecycleEmployee = Prisma.EmployeeGetPayload<{
  include: {
    employmentRecords: { include: typeof currentEmploymentInclude };
    probationRecords: true;
  };
}>;

function cleanRemarks(remarks: string | null | undefined): string | null {
  const cleaned = remarks?.trim() ?? '';
  if (cleaned.length > 2_000) {
    throw new EmploymentLifecycleError(
      'INVALID_STATE',
      'Remarks must not exceed 2,000 characters.'
    );
  }
  return cleaned || null;
}

function assertConfirmed(confirmed: boolean) {
  if (!confirmed) {
    throw new EmploymentLifecycleError(
      'CONFIRMATION_REQUIRED',
      'Explicit confirmation is required.'
    );
  }
}

async function getLifecycleContext(
  tx: Prisma.TransactionClient,
  input: BaseLifecycleInput,
  asOf: Date
): Promise<{ employee: LifecycleEmployee; employment: CurrentEmployment }> {
  const actor = await tx.user.findFirst({
    where: {
      id: input.actorUserId,
      organizationId: input.organizationId,
      role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
    },
    select: { id: true },
  });
  if (!actor) {
    throw new EmploymentLifecycleError(
      'EMPLOYEE_NOT_FOUND',
      'Employee not found or access denied.'
    );
  }

  const employee = await tx.employee.findFirst({
    where: { id: input.employeeId, organizationId: input.organizationId },
    include: {
      employmentRecords: {
        where: {
          effectiveFrom: { lte: asOf },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        include: currentEmploymentInclude,
        take: 1,
      },
      probationRecords: { orderBy: [{ startedAt: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!employee) {
    throw new EmploymentLifecycleError(
      'EMPLOYEE_NOT_FOUND',
      'Employee not found or access denied.'
    );
  }
  if (employee.employeeStatus !== EmployeeStatus.ACTIVE) {
    throw new EmploymentLifecycleError(
      'INVALID_STATE',
      'Only an active employee can receive a probation decision.'
    );
  }

  const employment = employee.employmentRecords[0];
  if (!employment || employment.employmentStatus !== EmploymentStatus.PROBATIONARY) {
    throw new EmploymentLifecycleError(
      'INVALID_STATE',
      'The employee does not have a current probationary Employment Record.'
    );
  }
  const probation = employment.probation;
  if (
    !probation ||
    probation.employeeId !== employee.id ||
    probation.probationStatus !== ProbationStatus.ACTIVE ||
    probation.decision !== ProbationDecision.PENDING
  ) {
    throw new EmploymentLifecycleError(
      'ALREADY_DECIDED',
      'The current probation period is no longer awaiting a decision.'
    );
  }
  if (probation.category !== employment.employmentCategory) {
    throw new EmploymentLifecycleError(
      'INVALID_STATE',
      'Employment and probation categories are inconsistent.'
    );
  }
  return { employee, employment };
}

function assertPeriodReached(expectedEndAt: Date, decisionAt: Date) {
  if (utcStartOfDay(decisionAt) < utcStartOfDay(expectedEndAt)) {
    throw new EmploymentLifecycleError(
      'NOT_YET_ELIGIBLE',
      'The probation period has not yet reached its expected end date.'
    );
  }
}

function assertEffectiveDate(input: {
  effectiveAt: Date;
  expectedEndAt: Date;
  decisionAt: Date;
  employmentEffectiveFrom: Date;
}) {
  if (
    Number.isNaN(input.effectiveAt.getTime()) ||
    input.effectiveAt < utcStartOfDay(input.expectedEndAt) ||
    input.effectiveAt < input.employmentEffectiveFrom ||
    input.effectiveAt > utcStartOfDay(input.decisionAt)
  ) {
    throw new EmploymentLifecycleError(
      'INVALID_EFFECTIVE_DATE',
      'The effective date must be on or after the probation end, within the current employment period, and not in the future.'
    );
  }
}

function previousSnapshot(employee: LifecycleEmployee, employment: CurrentEmployment) {
  const probation = employment.probation!;
  return {
    employeeStatus: employee.employeeStatus,
    employmentRecordId: employment.id,
    employmentStatus: employment.employmentStatus,
    employmentEffectiveFrom: employment.effectiveFrom.toISOString(),
    employmentEffectiveTo: null,
    probationRecordId: probation.id,
    probationStatus: probation.probationStatus,
    probationDecision: probation.decision,
    probationStartedAt: probation.startedAt.toISOString(),
    probationExpectedEndAt: probation.expectedEndAt.toISOString(),
    renewalCount: probation.renewalCount,
    maxRenewals: probation.maxRenewals,
  } satisfies Prisma.InputJsonObject;
}

function employmentCopy(
  employment: CurrentEmployment,
  actorUserId: string,
  effectiveFrom: Date,
  employmentStatus: EmploymentStatus
): Prisma.EmploymentRecordUncheckedCreateInput {
  return {
    employeeId: employment.employeeId,
    jobId: employment.jobId,
    acceptedOfferId: null,
    jobTitle: employment.jobTitle,
    department: employment.department,
    employmentCategory: employment.employmentCategory,
    employmentType: employment.employmentType,
    hireDate: employment.hireDate,
    startDate: employment.startDate,
    salary: employment.salary,
    payFrequency: employment.payFrequency,
    employmentStatus,
    effectiveFrom,
    createdById: actorUserId,
  };
}

async function claimProbation(
  tx: Prisma.TransactionClient,
  probationId: string,
  decision: ProbationDecision,
  decisionAt: Date,
  completedAt: Date,
  actorUserId: string,
  remarks: string | null
) {
  const claimed = await tx.probationRecord.updateMany({
    where: {
      id: probationId,
      probationStatus: ProbationStatus.ACTIVE,
      decision: ProbationDecision.PENDING,
    },
    data: {
      probationStatus: ProbationStatus.CLOSED,
      decision,
      decisionAt,
      completedAt,
      decisionById: actorUserId,
      remarks,
    },
  });
  if (claimed.count !== 1) {
    throw new EmploymentLifecycleError(
      'ALREADY_DECIDED',
      'Another decision has already been recorded for this probation period.'
    );
  }
}

async function closeEmployment(
  tx: Prisma.TransactionClient,
  employmentId: string,
  effectiveTo: Date
) {
  const closed = await tx.employmentRecord.updateMany({
    where: { id: employmentId, effectiveTo: null },
    data: { effectiveTo },
  });
  if (closed.count !== 1) {
    throw new EmploymentLifecycleError(
      'ALREADY_DECIDED',
      'Another lifecycle action has already changed the current employment.'
    );
  }
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EmploymentLifecycleError) throw error;
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!retryable || attempt === 3) throw error;
    }
  }
  throw new Error('Employment lifecycle decision failed after retrying.');
}

export async function regularizeEmployee(
  input: RegularizeEmployeeInput
): Promise<EmploymentLifecycleResult> {
  assertConfirmed(input.confirmed);
  const remarks = cleanRemarks(input.remarks);
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const decisionAt = input.decisionAt ?? new Date();
      const { employee, employment } = await getLifecycleContext(tx, input, decisionAt);
      const probation = employment.probation!;
      if (employment.employmentCategory !== EmploymentCategory.NON_TEACHING) {
        throw new EmploymentLifecycleError(
          'INVALID_STATE',
          'Regularization is available only for eligible Non-Teaching employees in H2.'
        );
      }
      assertPeriodReached(probation.expectedEndAt, decisionAt);
      assertEffectiveDate({
        effectiveAt: input.regularizationEffectiveAt,
        expectedEndAt: probation.expectedEndAt,
        decisionAt,
        employmentEffectiveFrom: employment.effectiveFrom,
      });

      const before = previousSnapshot(employee, employment);
      await claimProbation(
        tx,
        probation.id,
        ProbationDecision.REGULARIZED,
        decisionAt,
        input.regularizationEffectiveAt,
        input.actorUserId,
        remarks
      );
      await closeEmployment(tx, employment.id, input.regularizationEffectiveAt);
      const resulting = await tx.employmentRecord.create({
        data: employmentCopy(
          employment,
          input.actorUserId,
          input.regularizationEffectiveAt,
          EmploymentStatus.REGULAR
        ),
      });
      const after = {
        employeeStatus: EmployeeStatus.ACTIVE,
        employmentRecordId: resulting.id,
        employmentStatus: EmploymentStatus.REGULAR,
        employmentEffectiveFrom: resulting.effectiveFrom.toISOString(),
        employmentEffectiveTo: null,
        closedProbationRecordId: probation.id,
        probationStatus: ProbationStatus.CLOSED,
        probationDecision: ProbationDecision.REGULARIZED,
      } satisfies Prisma.InputJsonObject;
      await tx.employmentDecisionHistory.create({
        data: {
          employeeId: employee.id,
          probationRecordId: probation.id,
          previousEmploymentRecordId: employment.id,
          resultingEmploymentRecordId: resulting.id,
          decision: ProbationDecision.REGULARIZED,
          decisionAt,
          effectiveAt: input.regularizationEffectiveAt,
          changedById: input.actorUserId,
          remarks,
          previousState: before,
          newState: after,
        },
      });
      return {
        employeeId: employee.id,
        probationRecordId: probation.id,
        employmentRecordId: resulting.id,
        decision: ProbationDecision.REGULARIZED,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  );
}

export async function renewTeachingProbation(
  input: RenewTeachingProbationInput
): Promise<EmploymentLifecycleResult> {
  assertConfirmed(input.confirmed);
  const remarks = cleanRemarks(input.remarks);
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const decisionAt = input.decisionAt ?? new Date();
      const { employee, employment } = await getLifecycleContext(tx, input, decisionAt);
      const probation = employment.probation!;
      if (employment.employmentCategory !== EmploymentCategory.TEACHING) {
        throw new EmploymentLifecycleError(
          'INVALID_STATE',
          'Teaching probation renewal is available only to Teaching employees.'
        );
      }
      assertPeriodReached(probation.expectedEndAt, decisionAt);
      if (probation.renewalCount >= probation.maxRenewals) {
        throw new EmploymentLifecycleError(
          'MAX_RENEWALS_REACHED',
          'The maximum of two Teaching probation renewals has been reached.'
        );
      }
      const nextStart = input.nextSchoolYearStartDate;
      const nextEnd = input.nextSchoolYearEndDate;
      if (
        Number.isNaN(nextStart.getTime()) ||
        Number.isNaN(nextEnd.getTime()) ||
        nextEnd <= nextStart ||
        nextStart <= utcStartOfDay(probation.expectedEndAt)
      ) {
        throw new EmploymentLifecycleError(
          'INVALID_PERIOD',
          'The next school-year dates must not overlap the current period, and the end must be after the start.'
        );
      }
      const initialTeachingPeriod = employee.probationRecords.find(
        (record) =>
          record.category === EmploymentCategory.TEACHING &&
          record.previousProbationRecordId === null
      );
      if (!initialTeachingPeriod) {
        throw new EmploymentLifecycleError(
          'INVALID_STATE',
          'The initial Teaching probation period could not be identified.'
        );
      }
      if (nextEnd > addCalendarYearsClamped(initialTeachingPeriod.startedAt, 3)) {
        throw new EmploymentLifecycleError(
          'MAX_RENEWALS_REACHED',
          'The supplied period exceeds the defensive three-year Teaching probation limit.'
        );
      }
      const overlappingProbation = await tx.probationRecord.count({
        where: {
          employeeId: employee.id,
          id: { not: probation.id },
          startedAt: { lt: nextEnd },
          expectedEndAt: { gt: nextStart },
        },
      });
      const overlappingEmployment = await tx.employmentRecord.count({
        where: {
          employeeId: employee.id,
          id: { not: employment.id },
          effectiveFrom: { lt: nextEnd },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: nextStart } }],
        },
      });
      if (overlappingProbation > 0 || overlappingEmployment > 0) {
        throw new EmploymentLifecycleError(
          'INVALID_PERIOD',
          'The next school-year period overlaps existing employment or probation history.'
        );
      }

      const before = previousSnapshot(employee, employment);
      await claimProbation(
        tx,
        probation.id,
        ProbationDecision.RENEWED,
        decisionAt,
        probation.expectedEndAt,
        input.actorUserId,
        remarks
      );
      await closeEmployment(tx, employment.id, nextStart);
      const resulting = await tx.employmentRecord.create({
        data: employmentCopy(
          employment,
          input.actorUserId,
          nextStart,
          EmploymentStatus.PROBATIONARY
        ),
      });
      const nextProbation = await tx.probationRecord.create({
        data: {
          employeeId: employee.id,
          employmentRecordId: resulting.id,
          category: EmploymentCategory.TEACHING,
          startedAt: nextStart,
          expectedEndAt: nextEnd,
          renewalCount: probation.renewalCount + 1,
          maxRenewals: probation.maxRenewals,
          policySnapshot: probation.policySnapshot,
          previousProbationRecordId: probation.id,
        },
      });
      const after = {
        employeeStatus: EmployeeStatus.ACTIVE,
        employmentRecordId: resulting.id,
        employmentStatus: EmploymentStatus.PROBATIONARY,
        employmentEffectiveFrom: resulting.effectiveFrom.toISOString(),
        employmentEffectiveTo: null,
        probationRecordId: nextProbation.id,
        previousProbationRecordId: probation.id,
        probationStatus: ProbationStatus.ACTIVE,
        probationDecision: ProbationDecision.PENDING,
        probationStartedAt: nextStart.toISOString(),
        probationExpectedEndAt: nextEnd.toISOString(),
        renewalCount: nextProbation.renewalCount,
        maxRenewals: nextProbation.maxRenewals,
      } satisfies Prisma.InputJsonObject;
      await tx.employmentDecisionHistory.create({
        data: {
          employeeId: employee.id,
          probationRecordId: probation.id,
          previousEmploymentRecordId: employment.id,
          resultingEmploymentRecordId: resulting.id,
          decision: ProbationDecision.RENEWED,
          decisionAt,
          effectiveAt: nextStart,
          changedById: input.actorUserId,
          remarks,
          previousState: before,
          newState: after,
        },
      });
      return {
        employeeId: employee.id,
        probationRecordId: nextProbation.id,
        employmentRecordId: resulting.id,
        decision: ProbationDecision.RENEWED,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  );
}

export async function doNotRenewEmployee(
  input: DoNotRenewEmployeeInput
): Promise<EmploymentLifecycleResult> {
  assertConfirmed(input.confirmed);
  const remarks = cleanRemarks(input.remarks);
  if (!remarks) {
    throw new EmploymentLifecycleError(
      'REMARKS_REQUIRED',
      'Remarks are required when employment is not renewed.'
    );
  }
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const decisionAt = input.decisionAt ?? new Date();
      const { employee, employment } = await getLifecycleContext(tx, input, decisionAt);
      const probation = employment.probation!;
      assertPeriodReached(probation.expectedEndAt, decisionAt);
      assertEffectiveDate({
        effectiveAt: input.nonRenewalEffectiveAt,
        expectedEndAt: probation.expectedEndAt,
        decisionAt,
        employmentEffectiveFrom: employment.effectiveFrom,
      });

      const before = previousSnapshot(employee, employment);
      await claimProbation(
        tx,
        probation.id,
        ProbationDecision.NOT_RENEWED,
        decisionAt,
        input.nonRenewalEffectiveAt,
        input.actorUserId,
        remarks
      );
      await closeEmployment(tx, employment.id, input.nonRenewalEffectiveAt);
      const changed = await tx.employee.updateMany({
        where: {
          id: employee.id,
          organizationId: input.organizationId,
          employeeStatus: EmployeeStatus.ACTIVE,
        },
        data: { employeeStatus: EmployeeStatus.INACTIVE },
      });
      if (changed.count !== 1) {
        throw new EmploymentLifecycleError(
          'ALREADY_DECIDED',
          'Another lifecycle action has already changed the employee status.'
        );
      }
      await tx.employeeStatusHistory.create({
        data: {
          employeeId: employee.id,
          fromStatus: EmployeeStatus.ACTIVE,
          toStatus: EmployeeStatus.INACTIVE,
          changedById: input.actorUserId,
          reason: `Probation not renewed effective ${input.nonRenewalEffectiveAt.toISOString().slice(0, 10)}. ${remarks}`,
        },
      });
      const after = {
        employeeStatus: EmployeeStatus.INACTIVE,
        employmentRecordId: null,
        previousEmploymentRecordId: employment.id,
        employmentStatus: null,
        employmentEffectiveTo: input.nonRenewalEffectiveAt.toISOString(),
        closedProbationRecordId: probation.id,
        probationStatus: ProbationStatus.CLOSED,
        probationDecision: ProbationDecision.NOT_RENEWED,
      } satisfies Prisma.InputJsonObject;
      await tx.employmentDecisionHistory.create({
        data: {
          employeeId: employee.id,
          probationRecordId: probation.id,
          previousEmploymentRecordId: employment.id,
          decision: ProbationDecision.NOT_RENEWED,
          decisionAt,
          effectiveAt: input.nonRenewalEffectiveAt,
          changedById: input.actorUserId,
          remarks,
          previousState: before,
          newState: after,
        },
      });
      return {
        employeeId: employee.id,
        probationRecordId: probation.id,
        employmentRecordId: null,
        decision: ProbationDecision.NOT_RENEWED,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  );
}

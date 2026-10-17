import { Temporal } from '@js-temporal/polyfill';
import { EmployeeSeparationCase, Prisma } from '@prisma/client';
import { dateOnly, SeparationError } from './domain';

export const ACTIVE_SEPARATION_STATUSES = ['DRAFT', 'IN_PROGRESS', 'READY_FOR_FINAL_REVIEW', 'APPROVED_PENDING_EFFECTIVE'] as const;

export function organizationDate(now: Date, timeZone: string) {
  return Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(timeZone).toPlainDate().toString();
}

export async function inspectSeparationBoundary(tx: Prisma.TransactionClient, found: EmployeeSeparationCase, now: Date) {
  const organization = await tx.organization.findUniqueOrThrow({ where: { id: found.organizationId }, select: { timeZone: true } });
  const effective = found.proposedEffectiveDate;
  if (!effective || !found.proposedLastWorkingDay || found.proposedLastWorkingDay >= effective) {
    throw new SeparationError('INVALID_INPUT', 'The last working day must precede the effective separation date, which is the first day outside employment.');
  }
  const records = await tx.employmentRecord.findMany({ where: { employeeId: found.employeeId, employee: { organizationId: found.organizationId } }, orderBy: { effectiveFrom: 'asc' } });
  const open = records.filter(record => !record.effectiveTo);
  if (open.length > 1 || records.some(record => record.effectiveFrom >= effective || (record.effectiveTo && record.effectiveTo > effective))) {
    throw new SeparationError('INVALID_STATE', 'The effective date conflicts with existing or future employment history. Closed employment dates cannot be rewritten.');
  }
  if (records.length === 0 || found.proposedLastWorkingDay < records[0].effectiveFrom) throw new SeparationError('INVALID_INPUT', 'Separation dates must follow the employee employment start.');
  if (!records.some(record => record.effectiveFrom <= found.proposedLastWorkingDay! && (!record.effectiveTo || record.effectiveTo > found.proposedLastWorkingDay!))) {
    throw new SeparationError('INVALID_INPUT', 'The last working day must belong to a recorded employment interval; formal exit cannot invent work after an earlier non-renewal.');
  }
  // Employment dates follow H1/H2's UTC-encoded calendar dates and exclusive end
  // convention. Raw attendance instants instead use the institution's timezone.
  const localBoundary = new Date(Temporal.PlainDate.from(dateOnly(effective)!).toZonedDateTime({ timeZone: organization.timeZone, plainTime: '00:00' }).epochMilliseconds);
  const [events, attendance] = await Promise.all([
    tx.attendanceEvent.count({ where: { organizationId: found.organizationId, employeeId: found.employeeId, occurredAt: { gte: localBoundary } } }),
    tx.dailyAttendanceRecord.count({ where: {
      organizationId: found.organizationId, employeeId: found.employeeId, attendanceDate: { gte: effective },
      OR: [{ finalizedAt: { not: null } }, { firstTimeIn: { not: null } }, { lastTimeOut: { not: null } }, { correctionVersion: { gt: 0 } }, { workedSeconds: { gt: 0 } }],
    } }),
  ]);
  if (events || attendance) throw new SeparationError('INVALID_STATE', 'Recorded work or finalized attendance exists on or after the proposed separation date. Review the effective date; history will not be rewritten.');
  return { effective, today: organizationDate(now, organization.timeZone), timeZone: organization.timeZone, open, records };
}

export async function finalPayReadiness(tx: Prisma.TransactionClient, found: EmployeeSeparationCase) {
  const scope = { organizationId: found.organizationId, employeeId: found.employeeId };
  const effective = found.proposedEffectiveDate;
  const [clearance, payroll, leaves, employment] = await Promise.all([
    tx.employeeClearanceItem.findMany({ where: { organizationId: found.organizationId, caseId: found.id }, select: { id: true, category: true, title: true, status: true, isRequired: true, remarks: true } }),
    tx.payrollEntry.findMany({ where: { ...scope, OR: [{ status: { not: 'FINALIZED' } }, ...(effective ? [{ payrollPeriod: { periodEnd: { gte: effective } } }] : [])] }, select: { id: true, status: true, payrollPeriodId: true, payrollPeriod: { select: { periodStart: true, periodEnd: true } } } }),
    tx.leaveRequest.findMany({ where: { ...scope, OR: [{ status: 'PENDING' }, { attendanceSyncStatus: 'FAILED' }, ...(effective ? [{ status: 'APPROVED' as const, requestedEndDate: { gte: effective } }] : [])] }, select: { id: true, status: true, requestedStartDate: true, requestedEndDate: true, attendanceSyncStatus: true } }),
    tx.employmentRecord.findFirst({ where: { employeeId: found.employeeId, employee: { organizationId: found.organizationId } }, orderBy: { effectiveFrom: 'asc' }, select: { effectiveFrom: true } }),
  ]);
  const periods = effective && employment ? await tx.payrollPeriod.findMany({ where: {
    organizationId: found.organizationId, periodStart: { lt: effective }, periodEnd: { gte: employment.effectiveFrom },
    OR: [{ status: { not: 'FINALIZED' } }, { payrollEntries: { none: { employeeId: found.employeeId } } }],
  }, select: { id: true, status: true, periodStart: true, periodEnd: true } }) : [];
  const unresolved = clearance.filter(item => item.status === 'BLOCKED' || (item.isRequired && item.status === 'PENDING'));
  const required = clearance.filter(item => item.isRequired);
  return {
    caseId: found.id, separationEffectiveDate: dateOnly(effective), caseStatus: found.status,
    clearance: { required: required.length, completed: required.filter(item => item.status === 'CLEARED' || item.status === 'WAIVED').length },
    outstandingAccountabilities: unresolved,
    unresolvedPayrollEntries: payroll.filter(entry => entry.status !== 'FINALIZED').map(entry => ({ id: entry.id, status: entry.status, periodId: entry.payrollPeriodId })),
    finalizedPayrollOverlaps: payroll.filter(entry => entry.status === 'FINALIZED').map(entry => ({ id: entry.id, periodId: entry.payrollPeriodId, periodStart: dateOnly(entry.payrollPeriod.periodStart), periodEnd: dateOnly(entry.payrollPeriod.periodEnd) })),
    payrollPeriodsRequiringReview: periods.map(period => ({ id: period.id, status: period.status, periodStart: dateOnly(period.periodStart), periodEnd: dateOnly(period.periodEnd) })),
    leaveRecordsRequiringReview: leaves.map(leave => ({ id: leave.id, status: leave.status, from: dateOnly(leave.requestedStartDate), to: dateOnly(leave.requestedEndDate), attendanceSyncStatus: leave.attendanceSyncStatus })),
    status: !effective || unresolved.length || payroll.length || leaves.length || periods.length ? 'FOLLOW_UP_REQUIRED' : 'READY_FOR_FINANCE_REVIEW',
    calculationStatus: 'NOT_CALCULATED', paymentStatus: 'NOT_RECORDED',
    // Financial follow-up does not create additional institutional exit blockers.
    financialFollowUpBlocksSeparation: false,
  };
}

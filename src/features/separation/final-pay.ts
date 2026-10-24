import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { SeparationContext } from './core';
import { calendarDate, dateOnly, identifier, parseInput, SeparationError, text, toDate } from './domain';
import { organizationDate } from './finalization';
import { calculateFinalPay, deadlinePolicy, emptyFinalPayPayload, finalPayDeadline, finalPayDeadlinePolicySchema, finalPayPayloadSchema, finalPayBreakdownSchema } from './final-pay-domain';

type Tx = Prisma.TransactionClient;
type Run = <T>(operation: (tx: Tx, context: SeparationContext, slug: string) => Promise<T>, isolation?: Prisma.TransactionIsolationLevel) => Promise<T>;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
type DTO<T> = T extends Date | Prisma.Decimal ? string : T extends Array<infer U> ? DTO<U>[] : T extends object ? { [K in keyof T]: DTO<T[K]> } : T;
const dto = <T>(value: T): DTO<T> => JSON.parse(JSON.stringify(value)) as DTO<T>;
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(dto(value)))).digest('hex');
const versionSchema = z.object({ caseId: identifier, expectedVersion: z.number().int().nonnegative() }).strict();

export function createFinalPayOperations(run: Run, clock: () => Date) {
  function requireHR(context: SeparationContext) {
    if (context.role !== 'HR_ADMIN') throw new SeparationError('FORBIDDEN', 'Only the organization HR Administrator can process final pay.');
  }
  async function findCase(tx: Tx, context: SeparationContext, caseId: string) {
    const found = await tx.employeeSeparationCase.findFirst({ where: { id: caseId, organizationId: context.organizationId } });
    if (!found) throw new SeparationError('NOT_FOUND', 'Exit case is unavailable in this organization.');
    return found;
  }
  function caseSnapshot(found: Awaited<ReturnType<typeof findCase>>) {
    return { employeeId: found.employeeId, separationType: found.separationType, reason: found.reason, versionOfDetails: found.versionOfDetails, effectiveDate: dateOnly(found.proposedEffectiveDate), lastWorkingDay: dateOnly(found.proposedLastWorkingDay) };
  }
  async function sources(tx: Tx, found: Awaited<ReturnType<typeof findCase>>) {
    const scope = { organizationId: found.organizationId, employeeId: found.employeeId };
    const last = found.proposedLastWorkingDay;
    const yearStart = last ? toDate(`${dateOnly(last)!.slice(0, 4)}-01-01`)! : new Date('1900-01-01');
    const range = last ? { gte: yearStart, lte: last } : { gte: yearStart };
    const [payroll, payrollTotals, compensation, compensationTotals, attendance, attendanceCount, pendingLeave, balances, employment] = await Promise.all([
      tx.payrollEntry.findMany({ where: scope, select: { id: true, status: true, baseAmount: true, grossAmount: true, totalDeductions: true, netAmount: true, updatedAt: true, payrollPeriod: { select: { id: true, periodStart: true, periodEnd: true, status: true } } }, orderBy: { id: 'asc' }, take: 250 }),
      tx.payrollEntry.aggregate({ where: scope, _count: { id: true }, _sum: { grossAmount: true, netAmount: true, baseAmount: true }, _max: { updatedAt: true } }),
      tx.employeeCompensation.findMany({ where: scope, select: { id: true, compensationType: true, baseRate: true, currency: true, payFrequency: true, effectiveFrom: true, effectiveTo: true, status: true }, orderBy: [{ effectiveFrom: 'desc' }, { id: 'asc' }], take: 20 }),
      tx.employeeCompensation.aggregate({ where: scope, _count: { id: true }, _sum: { baseRate: true }, _max: { updatedAt: true } }),
      tx.dailyAttendanceRecord.aggregate({ where: { ...scope, attendanceDate: range }, _sum: { workedSeconds: true }, _count: { id: true }, _max: { updatedAt: true } }),
      tx.dailyAttendanceRecord.count({ where: { ...scope, attendanceDate: range, finalizedAt: null } }),
      tx.leaveRequest.count({ where: { ...scope, OR: [{ status: 'PENDING' }, { attendanceSyncStatus: 'FAILED' }] } }),
      tx.leaveLedgerEntry.groupBy({ by: ['leaveTypeId', 'leaveCycleId'], where: scope, _sum: { amountUnits: true }, orderBy: [{ leaveTypeId: 'asc' }, { leaveCycleId: 'asc' }] }),
      tx.employmentRecord.findMany({ where: { employeeId: found.employeeId, employee: { organizationId: found.organizationId } }, select: { id: true, effectiveFrom: true, effectiveTo: true, employmentCategory: true }, orderBy: { id: 'asc' } }),
    ]);
    const leaveTypes = await tx.leaveType.findMany({ where: { organizationId: found.organizationId, id: { in: balances.map(balance => balance.leaveTypeId) } }, select: { id: true, name: true, policyReference: true }, orderBy: { id: 'asc' } });
    const payrollCount = payrollTotals._count.id;
    return dto({ case: caseSnapshot(found), payroll, payrollCount, payrollTotals, compensation, compensationTotals, attendance, unfinalizedAttendance: attendanceCount, pendingOrFailedLeave: pendingLeave, balances, leaveTypes, employment,
      gaps: [
        'Payroll finalization is not proof of payment. Verify actual salary and 13th-month payments externally.',
        'Payroll base/gross amounts are not a verified 13th-month basic-earned basis. Reconcile absences, inclusions and external/opening records.',
        'Leave ledger balances are evidence only; convertible entitlement, cycles, daily rate and prior conversions require policy review.',
        'No automatic separation-pay entitlement, retirement benefit, final tax, tax refund, statutory contribution adjustment or currency conversion.',
        ...(payrollCount === 0 ? ['No payroll entries available. Provide verified external earnings/payment records.'] : []),
        ...(payrollCount > payroll.length ? ['Payroll evidence is limited to 250 entries. Reconcile the complete history externally.'] : []),
        ...(!compensation.length ? ['No compensation records available. A verified rate is required for rate-based calculations.'] : []),
        ...(compensation.some(item => item.currency !== 'PHP') ? ['Non-PHP compensation is present. Verify PHP settlement externally; no automatic FX conversion.'] : []),
        ...(attendanceCount ? ['Unfinalized attendance requires reconciliation.'] : []),
        ...(pendingLeave ? ['Pending / failed-sync leave requires reconciliation.'] : []),
      ] });
  }
  async function audit(tx: Tx, context: SeparationContext, finalPayId: string | null, action: string, details: unknown) {
    await tx.employeeFinalPayAudit.create({ data: { organizationId: context.organizationId, finalPayId, actorUserId: context.userId, action, details: json(details) } });
  }
  async function getFinalPayPolicySettings() {
    return run(async (tx, context) => {
      const org = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { finalPayPolicy: true } });
      return { policy: deadlinePolicy(org.finalPayPolicy), canEdit: context.role === 'HR_ADMIN' };
    });
  }
  async function saveFinalPayDeadlinePolicy(raw: unknown) {
    const input = parseInput(finalPayDeadlinePolicySchema, raw);
    return run(async (tx, context) => {
      requireHR(context);
      const previous = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { finalPayPolicy: true } });
      if (input.days > deadlinePolicy(previous.finalPayPolicy).days) throw new SeparationError('INVALID_INPUT', 'An existing favorable final-pay deadline cannot be extended.');
      await tx.organization.update({ where: { id: context.organizationId }, data: { finalPayPolicy: input } });
      await audit(tx, context, null, 'DEADLINE_POLICY_SAVED', { previous: previous.finalPayPolicy, next: input });
      return { success: true };
    });
  }
  async function getFinalPayManagement(caseId: string) {
    parseInput(identifier, caseId);
    return run(async (tx, context) => {
      const found = await findCase(tx, context, caseId);
      const [record, org, evidence] = await Promise.all([
        tx.employeeFinalPay.findFirst({ where: { caseId, organizationId: context.organizationId }, include: { payments: { orderBy: [{ paidOn: 'asc' }, { id: 'asc' }] }, audits: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } }),
        tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { finalPayPolicy: true, timeZone: true } }),
        sources(tx, found),
      ]);
      const policy = deadlinePolicy(org.finalPayPolicy);
      const paid = (record?.payments ?? []).reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      const outstanding = record?.netAmount == null ? null : record.netAmount.sub(paid);
      const paymentStatus = record?.status !== 'FINALIZED' ? 'NOT_FINALIZED' : record.netAmount!.isZero() ? 'NO_PAYMENT_DUE' : outstanding!.isZero() ? 'PAID' : paid.gt(0) ? 'PARTIALLY_PAID' : 'UNPAID';
      const effective = record ? dateOnly(record.separationDate) : dateOnly(found.proposedEffectiveDate);
      // Finalized obligations retain their approved deadline and its legal basis.
      // Later settings cannot retroactively relabel historical payments as late.
      const days = record?.status === 'FINALIZED' ? record.deadlineDays : Math.min(record?.deadlineDays ?? 30, policy.days);
      const basis = record?.status === 'FINALIZED' ? record.deadlineBasis : policy.days < (record?.deadlineDays ?? 31) ? policy.basis : record?.deadlineBasis ?? policy.basis;
      const due = effective ? finalPayDeadline(effective, days, organizationDate(clock(), org.timeZone), paymentStatus === 'PAID' ? dateOnly(record!.payments.at(-1)!.paidOn)! : undefined) : null;
      const lastWorkingDay = dateOnly(found.proposedLastWorkingDay);
      const thirteenthMonthDueDate = due && lastWorkingDay ? [due.dueDate, `${lastWorkingDay.slice(0, 4)}-12-24`].sort()[0] : null;
      return { record: dto(record), canEdit: context.role === 'HR_ADMIN', evidence,
        calculation: record?.status === 'FINALIZED' ? { lines: finalPayBreakdownSchema.parse(record.breakdown), blockers: [], gross: record.grossAmount!.toFixed(2), deductions: record.deductionAmount!.toFixed(2), net: record.netAmount!.toFixed(2) } : calculateFinalPay(record ? finalPayPayloadSchema.parse(record.payload) : emptyFinalPayPayload()),
        sourcesChanged: Boolean(record?.sourceHash && record.sourceHash !== hash(evidence)),
        paidAmount: paid.toFixed(2), outstandingAmount: outstanding?.toFixed(2) ?? null, paymentStatus,
        thirteenthMonthDueDate,
        deadline: effective && due ? { ...due, ...(paymentStatus === 'NO_PAYMENT_DUE' ? { status: 'NO_PAYMENT_DUE' } : {}), ...(found.status === 'CANCELLED' ? { status: 'CASE_CANCELLED' } : {}), separationDate: effective, days, basis } : null,
      };
    });
  }
  async function createFinalPay(caseId: string) {
    parseInput(identifier, caseId);
    return run(async (tx, context) => {
      requireHR(context);
      const found = await findCase(tx, context, caseId);
      const existing = await tx.employeeFinalPay.findFirst({ where: { caseId, organizationId: context.organizationId } });
      if (existing) return dto(existing);
      if (found.status === 'CANCELLED' || !found.proposedEffectiveDate) throw new SeparationError('INVALID_STATE', 'A non-cancelled case with an effective separation date is required.');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { finalPayPolicy: true } });
      const policy = deadlinePolicy(org.finalPayPolicy);
      const record = await tx.employeeFinalPay.create({ data: { organizationId: context.organizationId, caseId, payload: json(emptyFinalPayPayload()), caseSnapshot: caseSnapshot(found), separationDate: found.proposedEffectiveDate, deadlineDays: policy.days, deadlineBasis: policy.basis } });
      await audit(tx, context, record.id, 'CREATED', record);
      return dto(record);
    });
  }
  async function claim(tx: Tx, context: SeparationContext, input: z.infer<typeof versionSchema>) {
    requireHR(context);
    const found = await findCase(tx, context, input.caseId);
    if (found.status === 'CANCELLED') throw new SeparationError('INVALID_STATE', 'Cancelled cases cannot be processed for final pay.');
    const record = await tx.employeeFinalPay.findFirst({ where: { caseId: found.id, organizationId: context.organizationId } });
    if (!record) throw new SeparationError('NOT_FOUND', 'Create the final-pay draft first.');
    if (record.status === 'FINALIZED') throw new SeparationError('INVALID_STATE', 'Finalized final-pay amounts are immutable.');
    if (record.version !== input.expectedVersion) throw new SeparationError('CONFLICT', 'Final pay changed. Reload before continuing.');
    const claimed = await tx.employeeFinalPay.updateMany({ where: { id: record.id, organizationId: context.organizationId, version: input.expectedVersion, status: record.status }, data: { version: { increment: 1 } } });
    if (claimed.count !== 1) throw new SeparationError('CONFLICT', 'Final pay changed. Reload before continuing.');
    return { found, record };
  }
  async function saveFinalPayDraft(raw: unknown) {
    const input = parseInput(versionSchema.extend({ payload: finalPayPayloadSchema, deadlineDays: z.number().int().min(0).max(30), deadlineBasis: text }).strict(), raw);
    return run(async (tx, context) => {
      const { found, record } = await claim(tx, context, input);
      if (!found.proposedEffectiveDate) throw new SeparationError('INVALID_STATE', 'An effective separation date is required.');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { finalPayPolicy: true } });
      const maximumDays = Math.min(record.deadlineDays, deadlinePolicy(org.finalPayPolicy).days);
      if (input.deadlineDays > maximumDays) throw new SeparationError('INVALID_INPUT', `Deadline cannot be extended beyond ${maximumDays} days. Record any more favorable individual/CBA terms.`);
      // Compute to reject malformed supplied amounts, while retaining unresolved inputs.
      calculateFinalPay(input.payload);
      const next = await tx.employeeFinalPay.update({ where: { id: record.id }, data: { status: 'DRAFT', payload: json(input.payload), caseSnapshot: caseSnapshot(found), separationDate: found.proposedEffectiveDate, deadlineDays: input.deadlineDays, deadlineBasis: input.deadlineBasis, sourceSnapshot: Prisma.DbNull, sourceHash: null, breakdown: Prisma.DbNull, grossAmount: null, deductionAmount: null, netAmount: null, reviewedAt: null, reviewedById: null } });
      await audit(tx, context, record.id, 'DRAFT_SAVED', { previous: record, next });
      return dto(next);
    });
  }
  async function reviewFinalPay(raw: unknown) {
    const input = parseInput(versionSchema.extend({ confirmed: z.literal(true) }).strict(), raw);
    return run(async (tx, context) => {
      const { found, record } = await claim(tx, context, input);
      if (hash(record.caseSnapshot) !== hash(caseSnapshot(found))) throw new SeparationError('NOT_READY', 'Case grounds or dates changed. Save and reconcile the final-pay draft again.');
      const calculation = calculateFinalPay(finalPayPayloadSchema.parse(record.payload));
      if (calculation.blockers.length) throw new SeparationError('NOT_READY', calculation.blockers.join(' '));
      const evidence = await sources(tx, found);
      const next = await tx.employeeFinalPay.update({ where: { id: record.id }, data: { status: 'REVIEWED', sourceSnapshot: json(evidence), sourceHash: hash(evidence), breakdown: json(calculation.lines), grossAmount: calculation.gross!, deductionAmount: calculation.deductions!, netAmount: calculation.net!, reviewedById: context.userId, reviewedAt: clock() } });
      await audit(tx, context, record.id, 'HR_REVIEWED', next);
      return dto(next);
    });
  }
  async function approveFinalPay(raw: unknown) {
    const input = parseInput(versionSchema.extend({ decision: z.literal('APPROVE_FINAL_PAY'), remarks: text }).strict(), raw);
    return run(async (tx, context) => {
      const { found, record } = await claim(tx, context, input);
      if (found.status !== 'COMPLETED') throw new SeparationError('INVALID_STATE', 'Final approval requires the completed separation case with stable grounds and dates. Pending final pay never blocks separation.');
      if (record.status !== 'REVIEWED' || !record.reviewedById || !record.reviewedAt || record.netAmount == null) throw new SeparationError('NOT_READY', 'Explicit HR calculation review is required before approval.');
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { finalPayPolicy: true } });
      if (record.deadlineDays > deadlinePolicy(organization.finalPayPolicy).days) throw new SeparationError('NOT_READY', 'A more favorable organization deadline was configured. Save the draft with that deadline and review it again before approval.');
      const calculation = calculateFinalPay(finalPayPayloadSchema.parse(record.payload));
      if (calculation.blockers.length || calculation.net !== record.netAmount.toFixed(2) || record.sourceHash !== hash(await sources(tx, found)) || hash(record.caseSnapshot) !== hash(caseSnapshot(found))) throw new SeparationError('NOT_READY', 'Reviewed inputs or source records changed. Reconcile and review final pay again.');
      const next = await tx.employeeFinalPay.update({ where: { id: record.id }, data: { status: 'FINALIZED', finalizedById: context.userId, finalizedAt: clock(), approvalRemarks: input.remarks } });
      await audit(tx, context, record.id, 'FINAL_APPROVED', next);
      return dto(next);
    });
  }
  async function recordFinalPayPayment(raw: unknown) {
    const input = parseInput(z.object({ caseId: identifier, requestKey: identifier, amount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/), paidOn: calendarDate, reference: z.string().trim().min(1).max(200), remarks: text, confirmed: z.literal(true) }).strict(), raw);
    return run(async (tx, context) => {
      requireHR(context);
      const found = await findCase(tx, context, input.caseId);
      const record = await tx.employeeFinalPay.findFirst({ where: { caseId: found.id, organizationId: context.organizationId } });
      if (!record || record.status !== 'FINALIZED') throw new SeparationError('INVALID_STATE', 'Only approved final pay can have a payment recorded.');
      // Serialize append-only payments without changing immutable approved amounts.
      await tx.$queryRaw`SELECT "id" FROM "EmployeeFinalPay" WHERE "id"=${record.id} AND "organizationId"=${context.organizationId} FOR UPDATE`;
      const fingerprint = hash({ ...input, actor: context.userId });
      const replay = await tx.employeeFinalPayPayment.findUnique({ where: { organizationId_requestKey: { organizationId: context.organizationId, requestKey: input.requestKey } } });
      if (replay) {
        if (replay.finalPayId !== record.id || replay.requestFingerprint !== fingerprint) throw new SeparationError('CONFLICT', 'Payment request key was already used for different data.');
        return dto(replay);
      }
      const duplicateReference = await tx.employeeFinalPayPayment.findFirst({ where: { finalPayId: record.id, organizationId: context.organizationId, reference: input.reference }, select: { id: true } });
      if (duplicateReference) throw new SeparationError('CONFLICT', 'This payment reference is already recorded for this final pay.');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { timeZone: true } });
      if (input.paidOn < dateOnly(record.separationDate)! || input.paidOn > organizationDate(clock(), org.timeZone)) throw new SeparationError('INVALID_INPUT', 'Payment date must be on/after separation and no later than today.');
      const paid = await tx.employeeFinalPayPayment.aggregate({ where: { finalPayId: record.id, organizationId: context.organizationId }, _sum: { amount: true } });
      const amount = new Prisma.Decimal(input.amount);
      if (amount.lte(0) || amount.gt(record.netAmount!.sub(paid._sum.amount ?? 0))) throw new SeparationError('INVALID_INPUT', 'Payment must be positive and cannot exceed the approved outstanding amount.');
      const payment = await tx.employeeFinalPayPayment.create({ data: { organizationId: context.organizationId, finalPayId: record.id, amount, paidOn: toDate(input.paidOn)!, reference: input.reference, remarks: input.remarks, recordedById: context.userId, requestKey: input.requestKey, requestFingerprint: fingerprint } });
      await audit(tx, context, record.id, 'PAYMENT_RECORDED', payment);
      return dto(payment);
    }, Prisma.TransactionIsolationLevel.ReadCommitted);
  }
  return { getFinalPayManagement, createFinalPay, saveFinalPayDraft, reviewFinalPay, approveFinalPay, recordFinalPayPayment, getFinalPayPolicySettings, saveFinalPayDeadlinePolicy };
}

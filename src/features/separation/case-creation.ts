// Trusted transaction primitive shared by HR administration and eligible ESS
// submission. Each caller authenticates its actor; never expose this as an action.
import { Prisma } from '@prisma/client';
import { CreateCaseInput, SeparationError, toDate } from './domain';
import { ACTIVE_SEPARATION_STATUSES } from './finalization';
import { assessNotice, DEFAULT_CLEARANCE, resolveSeparationPolicy } from './policy';

const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

export async function createCaseInTransaction(tx: Prisma.TransactionClient, context: { userId: string; organizationId: string }, slug: string, input: CreateCaseInput, fingerprint: string, employeeNotice?: { submittedAt: string; timeZone: string }) {
  const replay = await tx.employeeSeparationCase.findUnique({ where: { organizationId_requestKey: { organizationId: context.organizationId, requestKey: input.requestKey } } });
  if (replay) {
    if (replay.requestFingerprint !== fingerprint || replay.initiatedById !== context.userId) throw new SeparationError('CONFLICT', 'This request key has already been used.');
    return replay;
  }
  const employee = await tx.employee.findFirst({ where: { id: input.employeeId, organizationId: context.organizationId }, select: { id: true, employeeStatus: true } });
  if (!employee) throw new SeparationError('NOT_FOUND', 'Employee is unavailable in this organization.');
  if (employee.employeeStatus === 'SEPARATED') throw new SeparationError('INVALID_STATE', 'A separated employee cannot have a new active exit case.');
  if (employee.employeeStatus === 'INACTIVE' && !input.inactiveEmployeeJustification) throw new SeparationError('INVALID_INPUT', 'An inactive employee requires an explicit administrative exit justification.');
  const active = await tx.employeeSeparationCase.findFirst({ where: { organizationId: context.organizationId, employeeId: employee.id, status: { in: [...ACTIVE_SEPARATION_STATUSES] } }, select: { id: true } });
  if (active) throw new SeparationError('DUPLICATE_CASE', 'An active exit case already exists for this employee. Contact HR before submitting another notice.');
  const organization = await tx.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { resignationPolicy: true } });
  const policy = resolveSeparationPolicy(slug, organization.resignationPolicy);
  const notice = employeeNotice ? { ...employeeNotice, reason: input.reason, noticeDate: input.noticeDate, proposedLastWorkingDay: input.proposedLastWorkingDay, proposedEffectiveDate: input.proposedEffectiveDate, policySnapshot: policy } : null;
  const created = await tx.employeeSeparationCase.create({ data: {
    organizationId: context.organizationId, employeeId: employee.id,
    separationType: input.separationType, reason: input.reason,
    noticeDate: toDate(input.noticeDate), proposedLastWorkingDay: toDate(input.proposedLastWorkingDay), proposedEffectiveDate: toDate(input.proposedEffectiveDate),
    noticeRemarks: input.noticeRemarks ?? null, administrativeRemarks: input.administrativeRemarks ?? null,
    initiatedById: context.userId, noticeCompliance: assessNotice(input, policy), policySnapshot: policy,
    inactiveEmployeeJustification: input.inactiveEmployeeJustification,
    requestKey: input.requestKey, requestFingerprint: fingerprint,
    ...(notice ? { submissionSource: 'ESS', employeeNoticeSnapshot: json(notice) } : {}),
  } });
  const audit = async (action: 'CASE_CREATED' | 'NOTICE_RECORDED' | 'CLEARANCE_ITEM_CREATED', next: unknown) => tx.employeeSeparationAudit.create({ data: { organizationId: context.organizationId, caseId: created.id, actorUserId: context.userId, action, newValues: json(next) } });
  await audit('CASE_CREATED', created);
  if (input.separationType === 'RESIGNATION') await audit('NOTICE_RECORDED', { noticeDate: created.noticeDate, proposedEffectiveDate: created.proposedEffectiveDate, noticeCompliance: created.noticeCompliance, ...(notice ? { event: 'ESS_RESIGNATION_SUBMITTED', originalNotice: notice } : {}) });
  for (const item of DEFAULT_CLEARANCE) {
    const clearance = await tx.employeeClearanceItem.create({ data: { ...item, organizationId: context.organizationId, caseId: created.id, isRequired: true, requestKey: `default:${item.category}` } });
    await audit('CLEARANCE_ITEM_CREATED', clearance);
  }
  return created;
}

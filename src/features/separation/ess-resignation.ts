// Internal ESS factory. Only the server service supplies session/tenant context.
import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { UserSessionPayload } from '@/lib/auth/session';
import { resolveEmployeeSelfContext, EmployeeSelfAccessError } from '../employee-self-service/access';
import { calendarDate, parseInput, SeparationError, text, toDate, validateDateOrder } from './domain';
import { ACTIVE_SEPARATION_STATUSES, organizationDate } from './finalization';
import { createCaseInTransaction } from './case-creation';
import { parsePolicySnapshot, resolveSeparationPolicy } from './policy';

export const submitResignationSchema = z.object({ requestKey: z.string().uuid(), reason: text, proposedLastWorkingDay: calendarDate, proposedEffectiveDate: calendarDate, confirmed: z.literal(true) }).strict();
const originalNoticeSchema = z.object({ submittedAt: z.string().datetime(), timeZone: z.string(), reason: text, noticeDate: calendarDate, proposedLastWorkingDay: calendarDate, proposedEffectiveDate: calendarDate, policySnapshot: z.unknown() });
const pageSchema = z.object({ page: z.number().int().min(1).max(100000).default(1) }).strict();
type Context = { session: UserSessionPayload | null; tenant: { organizationId: string } };

export function createEmployeeResignationService(db: PrismaClient, resolveContext: () => Promise<Context>, clock: () => Date = () => new Date()) {
  async function run<T>(operation: (tx: Prisma.TransactionClient, self: Awaited<ReturnType<typeof resolveEmployeeSelfContext>>) => Promise<T>, mutation = false) {
    try {
      const { session, tenant } = await resolveContext();
      return await db.$transaction(async tx => {
        let self = await resolveEmployeeSelfContext(session, tenant, tx);
        if (mutation) {
          // Share the lifecycle employee lock, then serialize account/role changes.
          await tx.$queryRaw`SELECT "id" FROM "Employee" WHERE "id"=${self.employee.id} AND "organizationId"=${self.organization.id} FOR UPDATE`;
          await tx.$queryRaw`SELECT "id" FROM "EmployeeAccount" WHERE "id"=${self.account.id} AND "organizationId"=${self.organization.id} FOR SHARE`;
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${self.user.id} AND "organizationId"=${self.organization.id} FOR SHARE`;
          self = await resolveEmployeeSelfContext(session, tenant, tx);
        }
        return operation(tx, self);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000, maxWait: 10000 });
    } catch (error) {
      if (error instanceof SeparationError) throw error;
      if (error instanceof EmployeeSelfAccessError) throw new SeparationError('FORBIDDEN', 'Current active employee self-service access is required.');
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new SeparationError('DUPLICATE_CASE', 'An active exit case or duplicate submission already exists. Reload your resignation page.');
        if (error.code === 'P2034') throw new SeparationError('CONFLICT', 'Employee eligibility or the exit case changed. Reload before submitting again.');
      }
      throw new SeparationError('UNAVAILABLE', 'Resignation information is temporarily unavailable. Reload before retrying.');
    }
  }

  async function getMyResignations(raw: unknown = {}) {
    const input = parseInput(pageSchema, raw);
    return run(async (tx, self) => {
      const where = { organizationId: self.organization.id, employeeId: self.employee.id, submissionSource: 'ESS', separationType: 'RESIGNATION' as const };
      const [org, activeCase, total, cases] = await Promise.all([
        tx.organization.findUniqueOrThrow({ where: { id: self.organization.id }, select: { slug: true, resignationPolicy: true } }),
        tx.employeeSeparationCase.findFirst({ where: { organizationId: self.organization.id, employeeId: self.employee.id, status: { in: [...ACTIVE_SEPARATION_STATUSES] } }, select: { id: true } }),
        tx.employeeSeparationCase.count({ where }),
        tx.employeeSeparationCase.findMany({ where, select: { id: true, status: true, employeeNoticeSnapshot: true, acknowledgedAt: true, acknowledgmentRemarks: true, noticeCompliance: true, completedAt: true, updatedAt: true, clearanceItems: { select: { isRequired: true, status: true, reviewedById: true, reviewedAt: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * 10, take: 10 }),
      ]);
      return {
        today: organizationDate(clock(), self.organization.timeZone), timeZone: self.organization.timeZone,
        policy: resolveSeparationPolicy(org.slug, org.resignationPolicy), hasActiveExit: Boolean(activeCase), total, page: input.page, pageSize: 10,
        items: cases.map(found => {
          const original = originalNoticeSchema.parse(found.employeeNoticeSnapshot);
          const required = found.clearanceItems.filter(item => item.isRequired);
          return { id: found.id, status: found.status, original: { ...original, policySnapshot: parsePolicySnapshot(original.policySnapshot) },
            acknowledgedAt: found.acknowledgedAt?.toISOString() ?? null, acknowledgmentRemarks: found.acknowledgmentRemarks,
            noticeCompliance: found.noticeCompliance, completedAt: found.completedAt?.toISOString() ?? null, updatedAt: found.updatedAt.toISOString(),
            clearance: { required: required.length, completed: required.filter(item => item.reviewedById && item.reviewedAt && ['CLEARED', 'WAIVED'].includes(item.status)).length },
          };
        }),
      };
    });
  }

  async function submitEmployeeResignation(raw: unknown) {
    const input = parseInput(submitResignationSchema, raw);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return run(async (tx, self) => {
      const requestKey = `ess:${self.user.id}:${input.requestKey}`;
      const replay = await tx.employeeSeparationCase.findUnique({ where: { organizationId_requestKey: { organizationId: self.organization.id, requestKey } }, select: { id: true, employeeId: true, initiatedById: true, requestFingerprint: true, submissionSource: true } });
      if (replay) {
        if (replay.employeeId !== self.employee.id || replay.initiatedById !== self.user.id || replay.requestFingerprint !== fingerprint || replay.submissionSource !== 'ESS') throw new SeparationError('CONFLICT', 'This submission key has already been used for different notice details.');
        return { caseId: replay.id, alreadySubmitted: true };
      }
      const today = organizationDate(clock(), self.organization.timeZone);
      const details = { separationType: 'RESIGNATION' as const, reason: input.reason, noticeDate: today, proposedLastWorkingDay: input.proposedLastWorkingDay, proposedEffectiveDate: input.proposedEffectiveDate };
      validateDateOrder(details);
      if (input.proposedLastWorkingDay < today || input.proposedLastWorkingDay >= input.proposedEffectiveDate) throw new SeparationError('INVALID_INPUT', 'Last working day must be today or later and must precede the effective separation date (the first day outside employment).');
      const employment = await tx.employmentRecord.findMany({ where: { employeeId: self.employee.id, employee: { organizationId: self.organization.id } }, select: { effectiveFrom: true, effectiveTo: true } });
      const day = toDate(today)!;
      const last = toDate(input.proposedLastWorkingDay)!;
      if (!employment.some(record => record.effectiveFrom <= day && (!record.effectiveTo || record.effectiveTo > day)) || !employment.some(record => record.effectiveFrom <= last && (!record.effectiveTo || record.effectiveTo > last))) throw new SeparationError('INVALID_INPUT', 'The proposed last working day must belong to recorded employment. Contact HR to resolve missing or conflicting employment dates.');
      const org = await tx.organization.findUniqueOrThrow({ where: { id: self.organization.id }, select: { slug: true } });
      const created = await createCaseInTransaction(tx, { userId: self.user.id, organizationId: self.organization.id }, org.slug, { ...details, employeeId: self.employee.id, requestKey }, fingerprint, { submittedAt: clock().toISOString(), timeZone: self.organization.timeZone });
      // Persisting this ESS case also creates the durable HR Requires Attention
      // notification. No email, access change, execution or final-pay calculation.
      return { caseId: created.id, alreadySubmitted: false };
    }, true);
  }
  return { getMyResignations, submitEmployeeResignation };
}

export const resignationStatusLabel = (status: string, acknowledged = false) => ({
  DRAFT: acknowledged ? 'Notice received by HR' : 'Notice submitted — awaiting HR acknowledgment',
  IN_PROGRESS: 'HR processing', READY_FOR_FINAL_REVIEW: 'Administrative review',
  APPROVED_PENDING_EFFECTIVE: 'Administrative checks recorded — awaiting separation processing',
  COMPLETED: 'Separation processed', CANCELLED: 'Employee withdrawal recorded',
}[status] ?? status);

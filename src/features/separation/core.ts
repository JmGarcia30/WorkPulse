// Internal server-side implementation. Browser entry points must use service.ts,
// whose context resolver reads the authenticated session and request tenant.
import { createHash } from 'node:crypto';
import {
  ClearanceStatus, Prisma, PrismaClient, Role,
  SeparationAuditAction, SeparationCaseStatus, SeparationReviewKind,
} from '@prisma/client';
import { z } from 'zod';
import {
  CaseDetails, CreateCaseInput, ItemDetails, VersionInput, SeparationError,
  createSchema, dateOnly, detailsSchema, identifier, itemDetailsSchema,
  parseInput, text, toDate, validateDateOrder, versionSchema,
} from './domain';
import { assessNotice, DEFAULT_CLEARANCE, parsePolicySnapshot, resolveSeparationPolicy } from './policy';
import { ACTIVE_SEPARATION_STATUSES, finalPayReadiness, inspectSeparationBoundary } from './finalization';
import { disableEmployeeAccountInTransaction } from '../employee-self-service/account-state';

type Tx = Prisma.TransactionClient;
export interface SeparationContext { userId: string; organizationId: string; role: Role }
type JsonDTO<T> = T extends Date ? string : T extends Array<infer U> ? JsonDTO<U>[] : T extends object ? { [K in keyof T]: JsonDTO<T[K]> } : T;
const dto = <T>(value: T): JsonDTO<T> => JSON.parse(JSON.stringify(value)) as JsonDTO<T>;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const employeeSelect = { id: true, employeeNumber: true, firstName: true, lastName: true, employeeStatus: true } as const;
const caseInclude = { employee: { select: employeeSelect }, clearanceItems: { orderBy: { id: 'asc' as const } }, reviews: { orderBy: [{ recordedAt: 'asc' as const }, { id: 'asc' as const }] } } satisfies Prisma.EmployeeSeparationCaseInclude;
type FullCase = Prisma.EmployeeSeparationCaseGetPayload<{ include: typeof caseInclude }>;

// This factory accepts ONLY a trusted server context provider, never request data.
// It also lets integration tests exercise real transactions in a disposable schema.
export function createSeparationService(db: PrismaClient, resolveContext: () => Promise<SeparationContext>, clock: () => Date = () => new Date()) {
  async function authorize(tx: Tx, context: SeparationContext) {
    const actor = await tx.user.findFirst({ where: {
      id: context.userId, organizationId: context.organizationId,
      role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
    }, select: { id: true, role: true, organization: { select: { slug: true } } } });
    if (!actor || actor.role !== context.role) throw new SeparationError('FORBIDDEN', 'Separation administration is unavailable.');
    return actor;
  }

  async function run<T>(operation: (tx: Tx, context: SeparationContext, slug: string) => Promise<T>, isolationLevel: Prisma.TransactionIsolationLevel = Prisma.TransactionIsolationLevel.RepeatableRead): Promise<T> {
    try {
      const context = await resolveContext();
      if (!context?.userId || !context.organizationId) throw new SeparationError('FORBIDDEN', 'Authentication and tenant membership are required.');
      return await db.$transaction(async tx => {
        const actor = await authorize(tx, context);
        return operation(tx, context, actor.organization.slug);
      }, { maxWait: 10000, timeout: 15000, isolationLevel });
    } catch (error) {
      if (error instanceof SeparationError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') throw new SeparationError('DUPLICATE_CASE', 'An active case or duplicate request already exists.');
        if (error.code === 'P2034') throw new SeparationError('CONFLICT', 'Concurrent change detected. Reload the case and retry.');
      }
      throw new SeparationError('UNAVAILABLE', 'The separation operation could not be completed.');
    }
  }

  async function findCase(tx: Tx, context: SeparationContext, caseId: string) {
    const found = await tx.employeeSeparationCase.findFirst({ where: { id: caseId, organizationId: context.organizationId }, include: caseInclude });
    if (!found) throw new SeparationError('NOT_FOUND', 'Separation case is unavailable.');
    return found;
  }

  async function claim(tx: Tx, context: SeparationContext, input: VersionInput, allowReady = false) {
    const found = await findCase(tx, context, input.caseId);
    if (found.version !== input.expectedVersion) throw new SeparationError('CONFLICT', 'The case changed. Reload it before submitting again.');
    const allowed: readonly SeparationCaseStatus[] = allowReady ? ACTIVE_SEPARATION_STATUSES : ['DRAFT', 'IN_PROGRESS'];
    if (found.employee.employeeStatus === 'SEPARATED' || !allowed.includes(found.status)) {
      throw new SeparationError('INVALID_STATE', 'This case cannot be changed in its current state.');
    }
    const changed = await tx.employeeSeparationCase.updateMany({
      where: { id: found.id, organizationId: context.organizationId, version: input.expectedVersion, status: found.status },
      data: { version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new SeparationError('CONFLICT', 'The case changed. Reload it before submitting again.');
    return found;
  }

  async function audit(tx: Tx, context: SeparationContext, caseId: string, action: SeparationAuditAction, previous?: unknown, next?: unknown, remarks?: string) {
    await tx.employeeSeparationAudit.create({ data: {
      organizationId: context.organizationId, caseId, actorUserId: context.userId, action,
      ...(previous === undefined ? {} : { previousValues: json(previous) }),
      ...(next === undefined ? {} : { newValues: json(next) }), remarks,
    } });
  }

  function readiness(found: FullCase) {
    const blockers: string[] = [];
    const policy = parsePolicySnapshot(found.policySnapshot);
    if (found.status === 'CANCELLED') blockers.push('CASE_CANCELLED');
    if (found.status === 'DRAFT') blockers.push('CASE_NOT_IN_PROGRESS');
    if (found.status === 'COMPLETED') blockers.push('CASE_COMPLETED');
    if (found.employee.employeeStatus === 'SEPARATED') blockers.push('EMPLOYEE_ALREADY_SEPARATED');
    if (!found.reason.trim() || !found.proposedEffectiveDate || !found.proposedLastWorkingDay) blockers.push('MANDATORY_CASE_INFORMATION_MISSING');
    for (const category of policy.requiredCategories) {
      if (!found.clearanceItems.some(item => item.category === category && item.isRequired)) blockers.push(`MISSING_REQUIRED_CLEARANCE:${category}`);
    }
    for (const item of found.clearanceItems) {
      const verified = Boolean(item.reviewedById && item.reviewedAt);
      const complete = verified && (item.status === 'CLEARED' || (item.status === 'WAIVED' && Boolean(item.remarks?.trim())));
      // Optional requirements do not block readiness, including optional BLOCKED items.
      if (item.isRequired && !complete) blockers.push(`CLEARANCE_UNRESOLVED:${item.id}`);
    }
    if (found.separationType === 'RESIGNATION') {
      const calculated = assessNotice({ separationType: found.separationType, noticeDate: dateOnly(found.noticeDate), proposedEffectiveDate: dateOnly(found.proposedEffectiveDate) }, policy);
      const exceptionValid = calculated === 'EXCEPTION_REQUIRED' && found.noticeCompliance === 'EXCEPTION_RECORDED'
        && found.noticeExceptionReason?.trim() && found.noticeExceptionById && found.noticeExceptionAt;
      if (!(calculated === 'COMPLIANT' && found.noticeCompliance === 'COMPLIANT') && !exceptionValid) blockers.push('NOTICE_NOT_VALIDATED');
      if (policy.requireNoticeReviews) {
        for (const kind of ['NOTICE_SUPERIOR', 'NOTICE_HRMO'] as const) {
          if (!found.reviews.some(review => review.kind === kind && review.caseVersion === found.versionOfDetails && review.evidence.trim())) blockers.push(`REVIEW_PENDING:${kind}`);
        }
      }
    }
    if (found.separationType === 'TERMINATION') {
      for (const kind of ['TERMINATION_ADMIN_REVIEW', 'TERMINATION_DOCUMENTATION', 'TERMINATION_DUE_PROCESS'] as const) {
        if (!found.reviews.some(review => review.kind === kind && review.caseVersion === found.versionOfDetails && review.evidence.trim())) blockers.push(`REVIEW_PENDING:${kind}`);
      }
    }
    return { ready: blockers.length === 0, blockers };
  }

  function progress(found: FullCase) {
    const required = found.clearanceItems.filter(item => item.isRequired);
    return {
      required: required.length,
      completed: required.filter(item => item.reviewedById && item.reviewedAt && (item.status === 'CLEARED' || (item.status === 'WAIVED' && item.remarks?.trim()))).length,
      pending: required.filter(item => item.status === 'PENDING').length,
      blocked: required.filter(item => item.status === 'BLOCKED').length,
    };
  }

  function caseDTO(found: FullCase) {
    // Idempotency fingerprints are internal implementation details.
    const { requestFingerprint: _fingerprint, requestKey: _requestKey, ...details } = found;
    void _fingerprint; void _requestKey;
    return { ...dto(details), clearanceProgress: progress(found), readiness: readiness(found) };
  }

  function detailData(input: CaseDetails) {
    return {
      separationType: input.separationType, reason: input.reason,
      noticeDate: toDate(input.noticeDate), proposedLastWorkingDay: toDate(input.proposedLastWorkingDay),
      proposedEffectiveDate: toDate(input.proposedEffectiveDate), noticeRemarks: input.noticeRemarks ?? null,
      administrativeRemarks: input.administrativeRemarks ?? null,
    };
  }

  async function createSeparationCase(raw: CreateCaseInput) {
    const input = parseInput(createSchema, raw);
    validateDateOrder(input);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const operation = () => run(async (tx, context, slug) => {
      const replay = await tx.employeeSeparationCase.findUnique({ where: { organizationId_requestKey: { organizationId: context.organizationId, requestKey: input.requestKey } }, include: caseInclude });
      if (replay) {
        if (replay.requestFingerprint !== fingerprint || replay.initiatedById !== context.userId) throw new SeparationError('CONFLICT', 'This request key has already been used.');
        return caseDTO(replay);
      }
      const employee = await tx.employee.findFirst({ where: { id: input.employeeId, organizationId: context.organizationId }, select: employeeSelect });
      if (!employee) throw new SeparationError('NOT_FOUND', 'Employee is unavailable in this organization.');
      if (employee.employeeStatus === 'SEPARATED') throw new SeparationError('INVALID_STATE', 'A separated employee cannot have a new active exit case.');
      if (employee.employeeStatus === 'INACTIVE' && !input.inactiveEmployeeJustification) throw new SeparationError('INVALID_INPUT', 'An inactive employee requires an explicit administrative exit justification.');
      const active = await tx.employeeSeparationCase.findFirst({ where: { organizationId: context.organizationId, employeeId: employee.id, status: { in: [...ACTIVE_SEPARATION_STATUSES] } }, select: { id: true } });
      if (active) throw new SeparationError('DUPLICATE_CASE', 'This employee already has an active separation case.');
      const policy = resolveSeparationPolicy(slug);
      const created = await tx.employeeSeparationCase.create({ data: {
        organizationId: context.organizationId, employeeId: employee.id, ...detailData(input),
        initiatedById: context.userId, noticeCompliance: assessNotice(input, policy), policySnapshot: policy,
        inactiveEmployeeJustification: input.inactiveEmployeeJustification,
        requestKey: input.requestKey, requestFingerprint: fingerprint,
      } });
      await audit(tx, context, created.id, 'CASE_CREATED', undefined, created);
      if (input.separationType === 'RESIGNATION') await audit(tx, context, created.id, 'NOTICE_RECORDED', undefined, { noticeDate: created.noticeDate, proposedEffectiveDate: created.proposedEffectiveDate, noticeCompliance: created.noticeCompliance });
      for (const item of DEFAULT_CLEARANCE) {
        const clearance = await tx.employeeClearanceItem.create({ data: { ...item, organizationId: context.organizationId, caseId: created.id, isRequired: true, requestKey: `default:${item.category}` } });
        await audit(tx, context, created.id, 'CLEARANCE_ITEM_CREATED', undefined, clearance);
      }
      return caseDTO(await findCase(tx, context, created.id));
    });
    try { return await operation(); } catch (error) {
      // A same-key concurrent retry resolves to the committed original. A different
      // key still fails against the database's partial unique active-case index.
      if (error instanceof SeparationError && error.code === 'DUPLICATE_CASE') return operation();
      throw error;
    }
  }

  async function updateSeparationCase(raw: VersionInput & { details: CaseDetails; status?: 'IN_PROGRESS' }) {
    const input = parseInput(versionSchema.extend({ details: detailsSchema, status: z.literal('IN_PROGRESS').optional() }).strict(), raw);
    validateDateOrder(input.details);
    return run(async (tx, context) => {
      const before = await claim(tx, context, input);
      const updated = await tx.employeeSeparationCase.update({ where: { id: before.id }, data: {
        ...detailData(input.details), status: input.status ?? before.status,
        noticeCompliance: assessNotice(input.details, parsePolicySnapshot(before.policySnapshot)),
        // Any details revision invalidates previous notice exceptions and reviews.
        noticeExceptionReason: null, noticeExceptionById: null, noticeExceptionAt: null,
        versionOfDetails: { increment: 1 },
      } });
      await audit(tx, context, before.id, 'CASE_UPDATED', before, updated);
      if (before.separationType === 'RESIGNATION' || updated.separationType === 'RESIGNATION') await audit(tx, context, before.id, 'NOTICE_RECORDED', { noticeDate: before.noticeDate, proposedEffectiveDate: before.proposedEffectiveDate, noticeCompliance: before.noticeCompliance }, { noticeDate: updated.noticeDate, proposedEffectiveDate: updated.proposedEffectiveDate, noticeCompliance: updated.noticeCompliance });
      return caseDTO(await findCase(tx, context, before.id));
    });
  }

  async function cancelSeparationCase(raw: VersionInput & { reason: string }) {
    const input = parseInput(versionSchema.extend({ reason: text }).strict(), raw);
    return run(async (tx, context) => {
      const before = await claim(tx, context, input, true);
      const after = await tx.employeeSeparationCase.update({ where: { id: before.id }, data: { status: 'CANCELLED', cancellationReason: input.reason, cancelledById: context.userId, cancelledAt: new Date() } });
      await audit(tx, context, before.id, 'CASE_CANCELLED', before, after, input.reason);
      return caseDTO(await findCase(tx, context, before.id));
    });
  }

  async function recordNoticeException(raw: VersionInput & { reason: string }) {
    const input = parseInput(versionSchema.extend({ reason: text }).strict(), raw);
    return run(async (tx, context) => {
      const before = await claim(tx, context, input);
      const calculated = assessNotice({ separationType: before.separationType, noticeDate: dateOnly(before.noticeDate), proposedEffectiveDate: dateOnly(before.proposedEffectiveDate) }, parsePolicySnapshot(before.policySnapshot));
      if (calculated !== 'EXCEPTION_REQUIRED') throw new SeparationError('INVALID_STATE', 'Only a validated short resignation notice can receive an exception.');
      const after = await tx.employeeSeparationCase.update({ where: { id: before.id }, data: { noticeCompliance: 'EXCEPTION_RECORDED', noticeExceptionReason: input.reason, noticeExceptionById: context.userId, noticeExceptionAt: new Date() } });
      await audit(tx, context, before.id, 'NOTICE_EXCEPTION_RECORDED', before, after, input.reason);
      return caseDTO(await findCase(tx, context, before.id));
    });
  }

  async function addClearanceItem(raw: VersionInput & { requestKey: string; item: ItemDetails }) {
    const input = parseInput(versionSchema.extend({ requestKey: identifier, item: itemDetailsSchema }).strict(), raw);
    return run(async (tx, context) => {
      const found = await claim(tx, context, input);
      const item = await tx.employeeClearanceItem.create({ data: { ...input.item, organizationId: context.organizationId, caseId: found.id, requestKey: input.requestKey } });
      await audit(tx, context, found.id, 'CLEARANCE_ITEM_CREATED', undefined, item);
      return caseDTO(await findCase(tx, context, found.id));
    });
  }

  async function updateClearanceItem(raw: VersionInput & { itemId: string; item: ItemDetails }) {
    const input = parseInput(versionSchema.extend({ itemId: identifier, item: itemDetailsSchema }).strict(), raw);
    return run(async (tx, context) => {
      const found = await claim(tx, context, input);
      const before = found.clearanceItems.find(item => item.id === input.itemId);
      if (!before) throw new SeparationError('NOT_FOUND', 'Clearance requirement is unavailable.');
      const after = await tx.employeeClearanceItem.update({ where: { id: before.id }, data: {
        ...input.item, description: input.item.description ?? null, responsibleUnit: input.item.responsibleUnit ?? null,
        // An edited requirement must be reviewed again.
        status: 'PENDING', reviewedById: null, reviewedAt: null, remarks: null,
      } });
      await audit(tx, context, found.id, 'CLEARANCE_UPDATED', before, after);
      return caseDTO(await findCase(tx, context, found.id));
    });
  }

  async function recordClearanceDecision(raw: VersionInput & { itemId: string; status: ClearanceStatus; remarks?: string | null; verified: boolean }) {
    const input = parseInput(versionSchema.extend({ itemId: identifier, status: z.enum(ClearanceStatus), remarks: text.nullable().optional(), verified: z.boolean() }).strict(), raw);
    if (input.status !== 'PENDING' && !input.verified) throw new SeparationError('INVALID_INPUT', 'Explicit verification of the clearance decision is required.');
    if ((input.status === 'WAIVED' || input.status === 'BLOCKED') && !input.remarks) throw new SeparationError('INVALID_INPUT', 'A waiver or blocker requires a reason.');
    return run(async (tx, context) => {
      const found = await claim(tx, context, input);
      const before = found.clearanceItems.find(item => item.id === input.itemId);
      if (!before) throw new SeparationError('NOT_FOUND', 'Clearance requirement is unavailable.');
      const after = await tx.employeeClearanceItem.update({ where: { id: before.id }, data: {
        status: input.status, remarks: input.remarks ?? null,
        reviewedById: input.status === 'PENDING' ? null : context.userId,
        reviewedAt: input.status === 'PENDING' ? null : new Date(),
      } });
      await audit(tx, context, found.id, input.status === 'WAIVED' ? 'CLEARANCE_WAIVED' : 'CLEARANCE_UPDATED', before, after, input.remarks ?? undefined);
      return caseDTO(await findCase(tx, context, found.id));
    });
  }

  async function recordSeparationReview(raw: VersionInput & { kind: SeparationReviewKind; evidence: string; verified: boolean }) {
    const input = parseInput(versionSchema.extend({ kind: z.enum(SeparationReviewKind), evidence: text, verified: z.literal(true) }).strict(), raw);
    return run(async (tx, context) => {
      const found = await claim(tx, context, input);
      const noticeReview = input.kind === 'NOTICE_SUPERIOR' || input.kind === 'NOTICE_HRMO';
      if ((noticeReview && found.separationType !== 'RESIGNATION') || (!noticeReview && found.separationType !== 'TERMINATION')) throw new SeparationError('INVALID_STATE', 'This review does not apply to the separation type.');
      const recorded = await tx.employeeSeparationReview.create({ data: {
        organizationId: context.organizationId, caseId: found.id, kind: input.kind,
        evidence: input.evidence, recordedById: context.userId, caseVersion: found.versionOfDetails,
      } });
      await audit(tx, context, found.id, 'REVIEW_RECORDED', undefined, recorded, input.evidence);
      return caseDTO(await findCase(tx, context, found.id));
    });
  }

  async function assessSeparationReadiness(caseId: string) {
    parseInput(identifier, caseId);
    return run(async (tx, context) => readiness(await findCase(tx, context, caseId)));
  }

  async function markReadyForFinalReview(raw: VersionInput) {
    const input = parseInput(versionSchema, raw);
    return run(async (tx, context) => {
      const before = await findCase(tx, context, input.caseId);
      if (before.status === 'READY_FOR_FINAL_REVIEW' && before.version === input.expectedVersion) return caseDTO(before);
      await claim(tx, context, input);
      // Re-read after claiming the case lock; all checklist writers claim this same
      // row first, so readiness cannot race a clearance edit or decision.
      const current = await findCase(tx, context, input.caseId);
      const assessed = readiness(current);
      if (!assessed.ready) throw new SeparationError('NOT_READY', `Case is not ready: ${assessed.blockers.join(', ')}.`);
      const after = await tx.employeeSeparationCase.update({ where: { id: before.id }, data: { status: 'READY_FOR_FINAL_REVIEW' } });
      await audit(tx, context, before.id, 'READY_FOR_REVIEW', { status: before.status }, { status: after.status, version: after.version });
      return caseDTO(await findCase(tx, context, before.id));
    });
  }

  async function getSeparationCaseById(caseId: string) {
    parseInput(identifier, caseId);
    return run(async (tx, context) => {
      const found = await findCase(tx, context, caseId);
      const history = await tx.employeeSeparationAudit.findMany({ where: { organizationId: context.organizationId, caseId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
      const employment = await tx.employmentRecord.findMany({ where: { employeeId: found.employeeId, employee: { organizationId: context.organizationId } }, select: { id: true, jobTitle: true, department: true, effectiveFrom: true, effectiveTo: true }, orderBy: { effectiveFrom: 'desc' }, take: 10 });
      return { ...caseDTO(found), employment: dto(employment), history: dto(history) };
    });
  }

  async function getSeparationAuditHistory(caseId: string, options: { page?: number; pageSize?: number } = {}) {
    const paging = parseInput(z.object({ page: z.number().int().min(1).max(100000).default(1), pageSize: z.number().int().min(1).max(100).default(50) }).strict(), options);
    parseInput(identifier, caseId);
    return run(async (tx, context) => {
      await findCase(tx, context, caseId);
      const where = { organizationId: context.organizationId, caseId };
      const [total, items] = await Promise.all([
        tx.employeeSeparationAudit.count({ where }),
        tx.employeeSeparationAudit.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], skip: (paging.page - 1) * paging.pageSize, take: paging.pageSize }),
      ]);
      return { total, ...paging, items: dto(items) };
    });
  }

  async function getOrganizationSeparationCases(options: { page?: number; pageSize?: number; status?: SeparationCaseStatus; employeeId?: string; search?: string } = {}) {
    const input = parseInput(z.object({ page: z.number().int().min(1).max(100000).default(1), pageSize: z.number().int().min(1).max(100).default(25), status: z.enum(SeparationCaseStatus).optional(), employeeId: identifier.optional(), search: z.string().trim().max(100).optional() }).strict(), options);
    return run(async (tx, context) => {
      if (input.employeeId && !await tx.employee.findFirst({ where: { id: input.employeeId, organizationId: context.organizationId }, select: { id: true } })) throw new SeparationError('NOT_FOUND', 'Employee is unavailable.');
      const where: Prisma.EmployeeSeparationCaseWhereInput = { organizationId: context.organizationId, status: input.status, employeeId: input.employeeId,
        ...(input.search ? { employee: { OR: ['firstName', 'lastName', 'employeeNumber'].map(field => ({ [field]: { contains: input.search, mode: 'insensitive' } })) } } : {}),
      };
      // The transaction snapshot keeps the count and page mutually consistent.
      const [total, cases] = await Promise.all([
        tx.employeeSeparationCase.count({ where }),
        tx.employeeSeparationCase.findMany({ where, include: caseInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
      ]);
      return { total, page: input.page, pageSize: input.pageSize, items: cases.map(found => ({
        id: found.id, employee: dto(found.employee), separationType: found.separationType, status: found.status,
        proposedEffectiveDate: dateOnly(found.proposedEffectiveDate), clearanceProgress: progress(found),
        noticeCompliance: found.noticeCompliance, readiness: readiness(found),
        noticeReviewStatus: found.separationType !== 'RESIGNATION' ? 'NOT_APPLICABLE' : readiness(found).blockers.some(blocker => blocker.startsWith('NOTICE_') || blocker.startsWith('REVIEW_PENDING:NOTICE_')) ? 'PENDING' : 'RECORDED',
        approvedAt: found.approvedAt?.toISOString() ?? null,
        completedAt: found.completedAt?.toISOString() ?? null,
        createdAt: found.createdAt.toISOString(),
      })) };
    });
  }

  async function searchSeparationEmployees(search = '') {
    const query = parseInput(z.string().trim().max(100), search);
    return run(async (tx, context) => dto(await tx.employee.findMany({
      where: { organizationId: context.organizationId, employeeStatus: { in: ['ACTIVE', 'INACTIVE'] },
        ...(query ? { OR: ['firstName', 'lastName', 'employeeNumber'].map(field => ({ [field]: { contains: query, mode: 'insensitive' } })) } : {}),
      }, select: { ...employeeSelect, employmentRecords: { select: { id: true, effectiveFrom: true, effectiveTo: true }, orderBy: { effectiveFrom: 'desc' }, take: 5 } },
      orderBy: [{ lastName: 'asc' }, { id: 'asc' }], take: 20,
    })));
  }

  async function getEmployeeSeparationCases(employeeId: string, options: { page?: number; pageSize?: number } = {}) {
    // Parse before merging so a runtime caller cannot inject another employee ID.
    const paging = parseInput(z.object({ page: z.number().int().min(1).max(100000).optional(), pageSize: z.number().int().min(1).max(100).optional() }).strict(), options);
    return getOrganizationSeparationCases({ ...paging, employeeId: parseInput(identifier, employeeId) });
  }

  async function getEmployeeSeparationSummary(employeeId: string) {
    parseInput(identifier, employeeId);
    return run(async (tx, context) => {
      const employee = await tx.employee.findFirst({ where: { id: employeeId, organizationId: context.organizationId }, select: { id: true } });
      if (!employee) throw new SeparationError('NOT_FOUND', 'Employee is unavailable.');
      const found = await tx.employeeSeparationCase.findFirst({ where: { organizationId: context.organizationId, employeeId, status: { in: [...ACTIVE_SEPARATION_STATUSES] } }, include: caseInclude });
      return found ? { hasActiveCase: true, caseId: found.id, status: found.status, clearanceProgress: progress(found) }
        : { hasActiveCase: false, caseId: null, status: null, clearanceProgress: null };
    });
  }

  async function approveSeparationCase(raw: VersionInput & { decision: 'APPROVE_SEPARATION'; remarks: string; backdatedJustification?: string; inactiveEmployeeJustification?: string }) {
    const input = parseInput(versionSchema.extend({ decision: z.literal('APPROVE_SEPARATION'), remarks: text, backdatedJustification: text.optional(), inactiveEmployeeJustification: text.optional() }).strict(), raw);
    return run(async (tx, context) => {
      const before = await claim(tx, context, input, true);
      if (before.status !== 'READY_FOR_FINAL_REVIEW') throw new SeparationError('INVALID_STATE', 'Only a case ready for final review can be approved.');
      const assessed = readiness(before);
      if (!assessed.ready) throw new SeparationError('NOT_READY', `Approval blocked: ${assessed.blockers.join(', ')}.`);
      const now = clock();
      const boundary = await inspectSeparationBoundary(tx, before, now);
      if (dateOnly(boundary.effective)! < boundary.today && !input.backdatedJustification) throw new SeparationError('INVALID_INPUT', 'Backdated approval requires an explicit historical-date justification.');
      const inactiveReason = input.inactiveEmployeeJustification ?? before.inactiveEmployeeJustification;
      if (before.employee.employeeStatus === 'INACTIVE' && !inactiveReason) throw new SeparationError('INVALID_INPUT', 'Formal exit of an inactive employee requires an administrative justification.');
      if (before.employee.employeeStatus === 'ACTIVE' && boundary.open.length !== 1) throw new SeparationError('INVALID_STATE', 'An active employee requires one open employment record.');
      const followUp = await finalPayReadiness(tx, before);
      const after = await tx.employeeSeparationCase.update({ where: { id: before.id }, data: {
        status: 'APPROVED_PENDING_EFFECTIVE', approvedById: context.userId, approvedAt: now,
        approvalDecision: input.decision, approvalRemarks: input.remarks, approvedDetailsVersion: before.versionOfDetails,
        backdatedJustification: input.backdatedJustification ?? null, inactiveEmployeeJustification: inactiveReason,
      } });
      await audit(tx, context, before.id, 'CASE_APPROVED', { status: before.status }, { status: after.status, approvedById: after.approvedById, approvedAt: after.approvedAt, decision: after.approvalDecision, remarks: input.remarks, effectiveDate: dateOnly(boundary.effective), timeZone: boundary.timeZone, backdatedJustification: after.backdatedJustification, financialFollowUp: followUp }, input.remarks);
      return caseDTO(await findCase(tx, context, before.id));
    });
  }

  async function executeSeparation(raw: VersionInput & { remarks: string; backdatedJustification?: string }) {
    const input = parseInput(versionSchema.extend({ remarks: text, backdatedJustification: text.optional() }).strict(), raw);
    return run(async (tx, context) => {
      const before = await findCase(tx, context, input.caseId);
      if (before.status === 'COMPLETED') return caseDTO(before);
      await claim(tx, context, input, true);
      if (before.status !== 'APPROVED_PENDING_EFFECTIVE' || !before.approvedById || !before.approvedAt || before.approvalDecision !== 'APPROVE_SEPARATION' || !before.approvalRemarks || before.approvedDetailsVersion !== before.versionOfDetails) throw new SeparationError('INVALID_STATE', 'A current recorded final approval is required.');
      const assessed = readiness(before);
      if (!assessed.ready) throw new SeparationError('NOT_READY', `Execution blocked: ${assessed.blockers.join(', ')}.`);
      if (before.employee.employeeStatus === 'INACTIVE' && !before.inactiveEmployeeJustification) throw new SeparationError('INVALID_STATE', 'Inactive status requires an explicitly authorized administrative exit.');
      const now = clock();
      // Claim the employee row too. Database transaction guards for new active
      // work lock this same row, making status changes and eligibility atomic.
      const changed = await tx.employee.updateMany({ where: { id: before.employeeId, organizationId: context.organizationId, employeeStatus: before.employee.employeeStatus }, data: { employeeStatus: 'SEPARATED' } });
      if (changed.count !== 1) throw new SeparationError('CONFLICT', 'Another lifecycle action changed the employee.');
      const boundary = await inspectSeparationBoundary(tx, before, now);
      if (dateOnly(boundary.effective)! > boundary.today) throw new SeparationError('INVALID_STATE', 'Separation cannot execute before the effective date in the organization timezone.');
      if (dateOnly(boundary.effective)! < boundary.today && !before.backdatedJustification && !input.backdatedJustification) throw new SeparationError('INVALID_INPUT', 'Late or backdated execution requires an explicit historical-date justification.');
      if (before.employee.employeeStatus === 'ACTIVE' && boundary.open.length !== 1) throw new SeparationError('INVALID_STATE', 'An active employee requires one open employment record.');
      const statusHistory = await tx.employeeStatusHistory.create({ data: {
        employeeId: before.employeeId, fromStatus: before.employee.employeeStatus, toStatus: 'SEPARATED', changedById: context.userId,
        reason: `Formal separation case ${before.id}, effective ${dateOnly(boundary.effective)}. ${input.remarks}`,
      } });
      for (const employment of boundary.open) {
        const closed = await tx.employmentRecord.updateMany({ where: { id: employment.id, employeeId: before.employeeId, effectiveTo: null }, data: { effectiveTo: boundary.effective } });
        if (closed.count !== 1) throw new SeparationError('CONFLICT', 'Employment changed during separation.');
        await audit(tx, context, before.id, 'EMPLOYMENT_CLOSED', { id: employment.id, effectiveTo: null }, { id: employment.id, effectiveTo: dateOnly(boundary.effective), endBoundary: 'EXCLUSIVE' });
      }
      const probations = await tx.probationRecord.findMany({ where: { employeeId: before.employeeId, employee: { organizationId: context.organizationId }, probationStatus: 'ACTIVE' } });
      for (const probation of probations) {
        if (probation.decision !== 'PENDING' || probation.startedAt >= boundary.effective) throw new SeparationError('INVALID_STATE', 'Unresolved probation dates or decision state need review.');
        await tx.probationRecord.update({ where: { id: probation.id }, data: { probationStatus: 'CLOSED', completedAt: boundary.effective, closedBySeparationCaseId: before.id } });
        await audit(tx, context, before.id, 'PROBATION_CLOSED', probation, { id: probation.id, probationStatus: 'CLOSED', decision: 'PENDING', completedAt: dateOnly(boundary.effective), closedBySeparationCaseId: before.id }, 'Closed by formal separation; no H2 probation decision was made.');
      }
      const account = await tx.employeeAccount.findFirst({ where: { organizationId: context.organizationId, employeeId: before.employeeId }, select: { id: true } });
      if (account) await disableEmployeeAccountInTransaction(tx, { organizationId: context.organizationId, accountId: account.id, actorUserId: context.userId, now, reason: `Formal separation case ${before.id}, effective ${dateOnly(boundary.effective)}.` });
      const completion = {
        effectiveDate: dateOnly(boundary.effective), lastWorkingDay: dateOnly(before.proposedLastWorkingDay), timeZone: boundary.timeZone,
        previousEmployeeStatus: before.employee.employeeStatus, employeeStatus: 'SEPARATED', statusHistoryId: statusHistory.id,
        closedEmploymentRecordIds: boundary.open.map(record => record.id), closedProbationRecordIds: probations.map(record => record.id),
        employeeAccountId: account?.id ?? null, backdatedJustification: input.backdatedJustification ?? before.backdatedJustification,
        financialFollowUp: await finalPayReadiness(tx, before),
      };
      await tx.employeeSeparationCase.update({ where: { id: before.id }, data: { status: 'COMPLETED', completedById: context.userId, completedAt: now, executionRemarks: input.remarks, completionSnapshot: json(completion) } });
      await audit(tx, context, before.id, 'SEPARATION_COMPLETED', { status: before.status, employeeStatus: before.employee.employeeStatus }, completion, input.remarks);
      return caseDTO(await findCase(tx, context, before.id));
    // See work committed while waiting for the employee lock. The case CAS and
    // employee lock serialize writers; an older repeatable-read snapshot cannot.
    }, Prisma.TransactionIsolationLevel.ReadCommitted);
  }

  async function getFinalPayReadiness(caseId: string) {
    parseInput(identifier, caseId);
    return run(async (tx, context) => finalPayReadiness(tx, await findCase(tx, context, caseId)));
  }

  const getPendingFinalApprovals = (options: { page?: number; pageSize?: number } = {}) => getOrganizationSeparationCases({ ...parseInput(z.object({ page: z.number().int().min(1).max(100000).optional(), pageSize: z.number().int().min(1).max(100).optional() }).strict(), options), status: 'READY_FOR_FINAL_REVIEW' });
  const getApprovedSeparations = (options: { page?: number; pageSize?: number } = {}) => getOrganizationSeparationCases({ ...parseInput(z.object({ page: z.number().int().min(1).max(100000).optional(), pageSize: z.number().int().min(1).max(100).optional() }).strict(), options), status: 'APPROVED_PENDING_EFFECTIVE' });
  const getCompletedSeparations = (options: { page?: number; pageSize?: number } = {}) => getOrganizationSeparationCases({ ...parseInput(z.object({ page: z.number().int().min(1).max(100000).optional(), pageSize: z.number().int().min(1).max(100).optional() }).strict(), options), status: 'COMPLETED' });

  return {
    searchSeparationEmployees,
    createSeparationCase, updateSeparationCase, cancelSeparationCase,
    addClearanceItem, updateClearanceItem, recordClearanceDecision,
    recordNoticeException, recordSeparationReview, assessSeparationReadiness,
    markReadyForFinalReview, getSeparationCaseById, getEmployeeSeparationCases,
    getOrganizationSeparationCases, getEmployeeSeparationSummary, getSeparationAuditHistory,
    approveSeparationCase, executeSeparation, getFinalPayReadiness,
    getPendingFinalApprovals, getApprovedSeparations, getCompletedSeparations,
  };
}

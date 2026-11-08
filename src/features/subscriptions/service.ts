import 'server-only';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { isCurrentEntitlement, subscriptionMonths } from './domain';

const id = z.string().trim().min(1).max(200);
const tier = z.enum(['BASIC', 'PRO']);
const months = z.number().int().min(1).max(120);
const note = z.string().trim().max(1000);
export const planConfiguration = z.object({
  tier, description: z.string().trim().min(1).max(1000),
  monthlyPriceMinor: z.number().int().min(0).max(999999999).nullable(),
  yearlyPriceMinor: z.number().int().min(0).max(999999999).nullable(),
  maxEmployees: z.number().int().min(1).max(999999).nullable(), active: z.boolean(),
  aiResumeParsing: z.boolean(), advancedAnalytics: z.boolean(), gmailIntegration: z.boolean(), customBranding: z.boolean(),
});
type Tx = Prisma.TransactionClient;
const snapshot = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));

async function lock(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subscription:${organizationId}`},0))::text`;
}
async function administrator(tx: Tx, administratorId: string) {
  const actor = await tx.platformAdministrator.findUnique({ where: { id: id.parse(administratorId) } });
  if (!actor || actor.disabledAt) throw new Error('SUBSCRIPTION_FORBIDDEN');
}

export async function configurePlan(db: PrismaClient, administratorId: string, raw: z.input<typeof planConfiguration>) {
  const { tier: planTier, ...data } = planConfiguration.parse(raw);
  return db.$transaction(async tx => {
    await administrator(tx, administratorId);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`subscription-plan:${planTier}`},0))::text`;
    const before = await tx.subscriptionPlan.findUniqueOrThrow({ where: { tier: planTier } });
    const after = await tx.subscriptionPlan.update({ where: { tier: planTier }, data });
    await tx.subscriptionEvent.create({ data: { actorAdministratorId: administratorId,
      action: 'PLAN_CONFIGURATION_UPDATED', details: snapshot({ tier: planTier, before, after }) } });
    return after;
  });
}

export async function submitSubscriptionRequest(db: PrismaClient, actor: { userId: string; organizationId: string }, rawTier: unknown) {
  const planTier = tier.parse(rawTier), organizationId = id.parse(actor.organizationId);
  return db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: id.parse(actor.userId) } });
    if (!user || user.organizationId !== organizationId || !['ORGANIZATION_ADMIN','HR_ADMIN'].includes(user.role)) {
      throw new Error('SUBSCRIPTION_FORBIDDEN');
    }
    await lock(tx, organizationId);
    const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { tier: planTier } });
    if (!plan.active) throw new Error('SUBSCRIPTION_PLAN_UNAVAILABLE');
    if (await tx.subscriptionRequest.findFirst({ where: { organizationId, status: 'PENDING' } })) {
      throw new Error('SUBSCRIPTION_REQUEST_ALREADY_PENDING');
    }
    const request = await tx.subscriptionRequest.create({ data: { organizationId, planTier, requestedByUserId: user.id } });
    await tx.subscriptionEvent.create({ data: { organizationId, requestId: request.id, actorUserId: user.id,
      action: 'SUBSCRIPTION_REQUESTED', details: snapshot({ planTier, plan }) } });
    return request;
  });
}

// Call under the same tenant lock as activation/review. Reads enforce expiry
// immediately, independently of this persisted-status maintenance operation.
async function expire(tx: Tx, organizationId: string, now: Date) {
  const record = await tx.organizationSubscription.findUnique({ where: { organizationId } });
  if (record?.status !== 'ACTIVE' || !record.endsAt || record.endsAt > now) return;
  await tx.organizationSubscription.update({ where: { organizationId }, data: { status: 'EXPIRED', version: { increment: 1 } } });
  await tx.subscriptionEvent.create({ data: { organizationId, action: 'SUBSCRIPTION_EXPIRED',
    operationKey: `expiry:${organizationId}:${record.version}`, details: snapshot(record) } });
}

async function activate(tx: Tx, input: {
  organizationId: string; administratorId: string; planTier: 'BASIC'|'PRO'; durationMonths: number;
  source: 'MANUAL'|'COMPLIMENTARY'; requestId?: string; reviewNote: string;
}, now: Date) {
  await expire(tx, input.organizationId, now);
  const before = await tx.organizationSubscription.findUnique({ where: { organizationId: input.organizationId } });
  // Same-plan renewals preserve the remaining term. Plan switches explicitly
  // replace the term and retain a complete before/after audit snapshot.
  const samePlan = before?.planTier === input.planTier && isCurrentEntitlement(before, now);
  const base = input.source === 'MANUAL' && samePlan && before?.endsAt ? before.endsAt : now;
  const endsAt = subscriptionMonths(base, input.durationMonths);
  const startsAt = input.source === 'MANUAL' && samePlan ? before?.startsAt ?? now : now;
  const after = await tx.organizationSubscription.upsert({
    where: { organizationId: input.organizationId },
    create: { organizationId: input.organizationId, planTier: input.planTier, status: 'ACTIVE', source: input.source, startsAt, endsAt },
    update: { planTier: input.planTier, status: 'ACTIVE', source: input.source, startsAt, endsAt,
      billingInterval: null, cancelledAt: null, version: { increment: 1 } },
  });
  await tx.subscriptionEvent.create({ data: { organizationId: input.organizationId, requestId: input.requestId,
    actorAdministratorId: input.administratorId, action: input.source === 'COMPLIMENTARY' ? 'SAGA_COMPLIMENTARY_PRO_GRANTED_TWO_YEARS' : 'SUBSCRIPTION_ACTIVATED',
    details: snapshot({ before, after, durationMonths: input.durationMonths, reviewNote: input.reviewNote, paymentRecorded: false }) } });
  return after;
}

export async function reviewSubscriptionRequest(db: PrismaClient, administratorId: string, raw: {
  organizationId: string; requestId: string; decision: 'APPROVED'|'REJECTED'; durationMonths?: number; reviewNote: string;
}) {
  const input = z.object({ organizationId: id, requestId: id, decision: z.enum(['APPROVED','REJECTED']),
    durationMonths: months.optional(), reviewNote: note }).parse(raw);
  if (input.decision === 'APPROVED' && input.durationMonths === undefined) throw new Error('SUBSCRIPTION_INVALID_DURATION');
  if (input.decision === 'REJECTED' && !input.reviewNote) throw new Error('SUBSCRIPTION_REJECTION_REASON_REQUIRED');
  return db.$transaction(async tx => {
    await administrator(tx, administratorId);
    await lock(tx, input.organizationId);
    const request = await tx.subscriptionRequest.findFirst({ where: { id: input.requestId, organizationId: input.organizationId } });
    if (!request) throw new Error('SUBSCRIPTION_REQUEST_NOT_FOUND');
    if (request.status !== 'PENDING') throw new Error('SUBSCRIPTION_REQUEST_ALREADY_REVIEWED');
    const now = new Date();
    const subscription = input.decision === 'APPROVED' ? await activate(tx, {
      ...input, administratorId, planTier: request.planTier, durationMonths: input.durationMonths!, source: 'MANUAL',
    }, now) : null;
    const after = await tx.subscriptionRequest.update({ where: { id: request.id }, data: {
      status: input.decision, reviewedByAdministratorId: administratorId, reviewedAt: now, reviewNote: input.reviewNote,
      durationMonths: subscription ? input.durationMonths : null, startsAt: subscription?.startsAt, endsAt: subscription?.endsAt,
    } });
    await tx.subscriptionEvent.create({ data: { organizationId: input.organizationId, requestId: request.id,
      actorAdministratorId: administratorId, action: `SUBSCRIPTION_REQUEST_${input.decision}`, details: snapshot(after) } });
    return after;
  });
}

export async function activateSubscription(db: PrismaClient, administratorId: string, raw: {
  organizationId: string; planTier: 'BASIC'|'PRO'; durationMonths: number; reviewNote: string;
}) {
  const input = z.object({ organizationId: id, planTier: tier, durationMonths: months, reviewNote: note.min(1) }).parse(raw);
  return db.$transaction(async tx => {
    await administrator(tx, administratorId);
    await lock(tx, input.organizationId);
    if (await tx.subscriptionRequest.findFirst({ where: { organizationId: input.organizationId, status: 'PENDING' } })) {
      throw new Error('SUBSCRIPTION_REVIEW_PENDING_REQUEST_FIRST');
    }
    return activate(tx, { ...input, administratorId, source: 'MANUAL' }, new Date());
  });
}

export async function grantSagaPro(db: PrismaClient, administratorId: string, organizationId: string) {
  id.parse(organizationId);
  return db.$transaction(async tx => {
    await administrator(tx, administratorId);
    await lock(tx, organizationId);
    // Only identify SAGA by its existing protected identifier. Relationships,
    // forms and locks always use the immutable organization ID.
    const saga = await tx.organization.findUnique({ where: { id: organizationId } });
    if (saga?.slug !== 'st-aloysius') throw new Error('SUBSCRIPTION_NOT_SAGA');
    const existing = await tx.organizationSubscription.findUnique({ where: { organizationId } });
    if (existing?.source === 'COMPLIMENTARY' && isCurrentEntitlement(existing)) return 'ALREADY_GRANTED';
    if (existing?.source === 'GATEWAY' && isCurrentEntitlement(existing)) throw new Error('SUBSCRIPTION_EXISTING_PAID_TERM');
    await activate(tx, { organizationId, administratorId, planTier: 'PRO', durationMonths: 24,
      source: 'COMPLIMENTARY', reviewNote: 'SAGA two-year complimentary agreement; no payment or automatic renewal.' }, new Date());
    return 'GRANTED';
  });
}

export async function expireSubscription(db: PrismaClient, administratorId: string, organizationId: string) {
  id.parse(organizationId);
  await db.$transaction(async tx => {
    await administrator(tx, administratorId);
    await lock(tx, organizationId);
    await expire(tx, organizationId, new Date());
  });
}

export async function readOrganizationSubscriptions(db: PrismaClient, organizationId: string) {
  // Callers pass only the tenant from requireBackOfficeContext, never form input.
  id.parse(organizationId);
  const [subscription, plans, requests, events] = await Promise.all([
    db.organizationSubscription.findUnique({ where: { organizationId }, include: { plan: true } }),
    db.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
    db.subscriptionRequest.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.subscriptionEvent.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  return { subscription, plans, requests, events };
}

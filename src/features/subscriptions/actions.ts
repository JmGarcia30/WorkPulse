'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { getSubscriptionPrice, subscriptionTerm } from './entitlements';
import { createXenditPaymentSession, isXenditBillingConfigured } from './xendit';

type Result = { error?: string; success?: string };
const parseAmount = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw)) return null;
  const minor = Math.round(Number(raw) * 100);
  return Number.isSafeInteger(minor) && minor >= 0 ? minor : null;
};
export async function configureSubscriptionPlanAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  const tier = form.get('tier');
  if (tier !== 'BASIC' && tier !== 'PRO') return { error: 'Invalid plan.' };
  const monthly = parseAmount(form.get('monthly'));
  const yearly = parseAmount(form.get('yearly'));
  const rawLimit = String(form.get('maxEmployees') ?? '').trim();
  if (monthly === null || yearly === null || (rawLimit !== '' && !/^[1-9]\d{0,5}$/.test(rawLimit))) return { error: 'Enter valid PHP prices and an optional employee limit.' };
  const active = form.get('active') === 'yes';
  if (active && (monthly <= 0 || yearly <= 0)) return { error: 'Active plans need positive monthly and yearly prices.' };
  const data = {
    monthlyPriceMinor: monthly, yearlyPriceMinor: yearly, active,
    maxEmployees: rawLimit ? Number(rawLimit) : null,
    aiResumeParsing: form.get('aiResumeParsing') === 'yes',
    advancedAnalytics: form.get('advancedAnalytics') === 'yes',
    gmailIntegration: form.get('gmailIntegration') === 'yes',
    customBranding: form.get('customBranding') === 'yes',
  };
  try {
    await prisma.$transaction(async tx => {
      await tx.subscriptionPlan.update({ where: { tier }, data });
      const saga = await tx.organization.findUnique({ where: { slug: 'st-aloysius' }, select: { id: true } });
      if (!saga) throw new Error('SAGA_NOT_FOUND');
      await tx.subscriptionEvent.create({ data: {
        organizationId: saga.id, actorAdministratorId: actor.id, action: 'PLAN_CONFIGURATION_UPDATED_' + tier,
      } });
    });
    revalidatePath('/platform/subscriptions');
    revalidatePath('/dashboard/subscription');
    return { success: 'Plan settings saved. Existing subscriptions remain unchanged.' };
  } catch { return { error: 'Could not save plan settings.' }; }
}

export async function grantSagaComplimentaryProAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  if (form.get('confirmation') !== 'CONFIRM_SAGA_PRO') return { error: 'Confirm the SAGA Pro grant first.' };
  try {
    const outcome = await prisma.$transaction(async tx => {
      const saga = await tx.organization.findUnique({ where: { slug: 'st-aloysius' }, select: { id: true } });
      if (!saga) throw new Error('SAGA_NOT_FOUND');
      await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text", 'subscription:' + saga.id);
      const existing = await tx.organizationSubscription.findUnique({ where: { organizationId: saga.id } });
      const now = new Date();
      if (existing?.source === 'COMPLIMENTARY' && existing.status === 'ACTIVE' && existing.endsAt && existing.endsAt > now) return 'ALREADY_GRANTED';
      if (existing?.source === 'GATEWAY' && existing.status === 'ACTIVE' && existing.endsAt && existing.endsAt > now) return 'PAID_SUBSCRIPTION_ACTIVE';
      const endsAt = subscriptionTerm(subscriptionTerm(now, 'YEARLY'), 'YEARLY');
      await tx.organizationSubscription.upsert({
        where: { organizationId: saga.id },
        create: { organizationId: saga.id, planTier: 'PRO', status: 'ACTIVE', source: 'COMPLIMENTARY', startsAt: now, endsAt },
        update: { planTier: 'PRO', status: 'ACTIVE', source: 'COMPLIMENTARY', billingInterval: null,
          startsAt: now, endsAt, cancelledAt: null, version: { increment: 1 } },
      });
      await tx.subscriptionEvent.create({ data: { organizationId: saga.id,
        actorAdministratorId: actor.id, action: 'SAGA_COMPLIMENTARY_PRO_GRANTED_TWO_YEARS' } });
      return 'GRANTED';
    });
    revalidatePath('/platform/subscriptions');
    if (outcome === 'PAID_SUBSCRIPTION_ACTIVE') return { error: 'SAGA has an active paid term; review it first.' };
    return { success: outcome === 'ALREADY_GRANTED' ? 'SAGA already has active complimentary Pro.' : 'SAGA has complimentary Pro for two years, with no payment.' };
  } catch { return { error: 'Unable to grant complimentary Pro.' }; }
}

export async function beginPaidSubscriptionAction(form: FormData): Promise<void> {
  const actor = await requireBackOfficeContext();
  if (actor.role !== Role.HR_ADMIN && actor.role !== Role.ORGANIZATION_ADMIN) throw new Error('SUBSCRIPTION_FORBIDDEN');
  const input = z.object({
    tier: z.enum(['BASIC','PRO']),
    interval: z.enum(['MONTHLY','YEARLY']),
  }).safeParse({ tier: form.get('tier'), interval: form.get('interval') });
  if (!input.success) throw new Error('SUBSCRIPTION_INVALID_SELECTION');
  if (!isXenditBillingConfigured()) throw new Error('BILLING_PROVIDER_UNAVAILABLE');

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: input.data.tier } });
  const amountMinor = getSubscriptionPrice(plan, input.data.interval);
  const order = await prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text", 'subscription:' + actor.organizationId);
    const old = await tx.subscriptionOrder.findFirst({
      where: { organizationId: actor.organizationId, status: 'PENDING',
        createdAt: { gte: new Date(Date.now() - 20 * 60000) } }, orderBy: { createdAt: 'desc' },
    });
    if (old) {
      if (old.checkoutUrl && old.planTier === input.data.tier && old.interval === input.data.interval) return old;
      throw new Error('SUBSCRIPTION_CHECKOUT_ALREADY_PENDING');
    }
    const created = await tx.subscriptionOrder.create({ data: {
      organizationId: actor.organizationId, planTier: input.data.tier,
      interval: input.data.interval, amountMinor,
    } });
    await tx.subscriptionEvent.create({ data: {
      organizationId: actor.organizationId, orderId: created.id, action: 'CHECKOUT_REQUESTED',
    } });
    return created;
  });
  if (order.checkoutUrl) redirect(order.checkoutUrl);
  const session = await createXenditPaymentSession({
    orderId: order.id, amountMinor: order.amountMinor, organizationId: actor.organizationId,
    email: actor.email, tier: order.planTier, interval: order.interval,
  });
  const saved = await prisma.subscriptionOrder.updateMany({
    where: { id: order.id, status: 'PENDING', providerSessionId: null },
    data: { provider: 'XENDIT', providerSessionId: session.id,
      checkoutUrl: session.url, expiresAt: session.expiresAt },
  });
  if (saved.count !== 1) throw new Error('SUBSCRIPTION_CHECKOUT_RACE');
  redirect(session.url);
}

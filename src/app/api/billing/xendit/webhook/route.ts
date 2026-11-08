import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { fetchXenditPaymentSession, isXenditBillingConfigured } from '@/features/subscriptions/xendit';
import { isCurrentEntitlement, subscriptionTerm } from '@/features/subscriptions/entitlements';

export const runtime = 'nodejs';

function validToken(received: string | null, expected: string | undefined) {
  if (!received || !expected) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
export async function POST(request: NextRequest) {
  if (!isXenditBillingConfigured() || !validToken(request.headers.get('x-callback-token'), process.env.XENDIT_WEBHOOK_TOKEN)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > 32768) return new NextResponse('Payload too large', { status: 413 });
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse('Invalid JSON', { status: 400 }); }
  if (!payload || typeof payload !== 'object') return new NextResponse('Invalid event', { status: 400 });
  const event = payload as { event?: unknown; data?: { payment_session_id?: unknown } };
  if (event.event !== 'payment_session.completed' && event.event !== 'payment_session.expired') {
    return NextResponse.json({ ignored: true });
  }
  const sessionId = event.data?.payment_session_id;
  if (typeof sessionId !== 'string') return new NextResponse('Missing session ID', { status: 400 });
  // Verify the status independently with the payment provider, never from an
  // untrusted browser redirect or webhook body alone.
  let verified;
  try { verified = await fetchXenditPaymentSession(sessionId); }
  catch { return new NextResponse('Verification pending', { status: 503 }); }
  const order = await prisma.subscriptionOrder.findUnique({ where: { providerSessionId: sessionId } });
  if (!order || order.provider !== 'XENDIT') return new NextResponse('Unknown order', { status: 404 });
  if (verified.payment_session_id !== sessionId || verified.reference_id !== order.id ||
      verified.currency !== 'PHP' || verified.session_type !== 'PAY' ||
      Math.round(verified.amount * 100) !== order.amountMinor ||
      !Number.isFinite(verified.amount)) {
    return new NextResponse('Provider data mismatch', { status: 409 });
  }
  if (verified.status !== 'COMPLETED' && verified.status !== 'EXPIRED') return NextResponse.json({ pending: true });
  if (verified.status === 'COMPLETED' && !verified.payment_id) return new NextResponse('Payment evidence missing', { status: 503 });
  try {
    const state = await prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))::text',
        'subscription:' + order.organizationId,
      );
      const current = await tx.subscriptionOrder.findUnique({ where: { id: order.id } });
      if (!current || current.providerSessionId !== sessionId) throw new Error('STALE_PROVIDER_SESSION');
      if (current.status !== 'PENDING') return 'ALREADY_PROCESSED';
      if (verified.status === 'EXPIRED') {
        await tx.subscriptionOrder.update({ where: { id: order.id }, data: { status: 'EXPIRED' } });
        await tx.subscriptionEvent.create({ data: {
          organizationId: order.organizationId, orderId: order.id, action: 'PAYMENT_SESSION_EXPIRED',
          operationKey: 'xendit-expired:' + sessionId,
        } });
        return 'EXPIRED';
      }
      // A later successfully paid order supersedes any old pending checkout.
      const newerPayment = await tx.subscriptionOrder.findFirst({
        where: { organizationId: order.organizationId, status: 'PAID', paidAt: { not: null },
          createdAt: { gt: order.createdAt } },
        select: { id: true },
      });
      if (newerPayment) throw new Error('NEWER_PAID_ORDER_PRESENT');
      const existing = await tx.organizationSubscription.findUnique({ where: { organizationId: order.organizationId } });
      if (existing && isCurrentEntitlement(existing) && existing.source === 'COMPLIMENTARY') {
        throw new Error('COMPLIMENTARY_ENTITLEMENT_CONFLICT');
      }
      const now = new Date();
      const termStart = existing && isCurrentEntitlement(existing) && existing.endsAt && existing.planTier === order.planTier
        ? existing.endsAt : now;
      const endsAt = subscriptionTerm(termStart, order.interval);
      await tx.subscriptionOrder.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: now } });
      await tx.organizationSubscription.upsert({
        where: { organizationId: order.organizationId },
        create: { organizationId: order.organizationId, planTier: order.planTier,
          status: 'ACTIVE', source: 'GATEWAY', billingInterval: order.interval, startsAt: now, endsAt },
        update: { planTier: order.planTier, status: 'ACTIVE', source: 'GATEWAY',
          billingInterval: order.interval, startsAt: now, endsAt, cancelledAt: null, version: { increment: 1 } },
      });
      await tx.subscriptionEvent.create({ data: {
        organizationId: order.organizationId, orderId: order.id, action: 'PAYMENT_VERIFIED_SUBSCRIPTION_ACTIVATED',
        operationKey: 'xendit-paid:' + sessionId,
      } });
      return 'ACTIVATED';
    });
    return NextResponse.json({ processed: state });
  } catch {
    // Never mark a payment as complete when state or ordering is ambiguous.
    return new NextResponse('Subscription reconciliation required', { status: 503 });
  }
}

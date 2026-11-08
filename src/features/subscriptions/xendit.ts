import 'server-only';
import { SubscriptionBillingInterval, SubscriptionTier } from '@prisma/client';
import { publicOrigin } from '@/lib/tenant/host';

const endpoint = 'https://api.xendit.co/sessions';
export function isXenditBillingConfigured() {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key || !process.env.XENDIT_WEBHOOK_TOKEN) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  // Production must never activate entitlements using a sandbox payment key.
  return process.env.WORKPULSE_LIVE_BILLING_ENABLED === 'true' && key.startsWith('xnd_production_');
}
function auth() {
  if (!isXenditBillingConfigured()) throw new Error('BILLING_GATEWAY_NOT_ENABLED');
  return 'Basic ' + Buffer.from(process.env.XENDIT_SECRET_KEY + ':').toString('base64');
}
function isCheckoutUrl(url: string) {
  try {
    const target = new URL(url);
    return target.protocol === 'https:' &&
      ['checkout.xendit.co','checkout-staging.xendit.co','xen.to','dev.xen.to'].includes(target.hostname);
  } catch { return false; }
}
export type VerifiedSession = {
  payment_session_id: string;
  reference_id: string;
  status: string;
  session_type: string;
  amount: number;
  currency: string;
  payment_id?: string | null;
  expires_at?: string;
  payment_link_url?: string;
};
export async function fetchXenditPaymentSession(sessionId: string): Promise<VerifiedSession> {
  if (!/^ps-[A-Za-z0-9-]{20,90}$/.test(sessionId)) throw new Error('INVALID_GATEWAY_SESSION_ID');
  const response = await fetch(endpoint + '/' + encodeURIComponent(sessionId), {
    method: 'GET', headers: { Authorization: auth() }, cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('PAYMENT_PROVIDER_VERIFICATION_FAILED');
  return response.json() as Promise<VerifiedSession>;
}
export async function createXenditPaymentSession(input: {
  orderId: string; organizationId: string; email: string; amountMinor: number;
  tier: SubscriptionTier; interval: SubscriptionBillingInterval;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('INVALID_BILLING_AMOUNT');
  const origin = new URL(publicOrigin());
  if (origin.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('INVALID_BILLING_RETURN_ORIGIN');
  const apiAmount = input.amountMinor / 100;
  const payload = {
    reference_id: input.orderId, session_type: 'PAY', mode: 'PAYMENT_LINK',
    amount: apiAmount, currency: 'PHP', country: 'PH',
    description: 'WorkPulse ' + input.tier + ' ' + input.interval.toLowerCase() + ' subscription',
    customer: { reference_id: input.organizationId.replace(/[^a-zA-Z0-9]/g,'').slice(0,50),
      type: 'INDIVIDUAL', email: input.email.slice(0,50),
      individual_detail: { given_names: 'WorkPulse', surname: 'Administrator' } },
    success_return_url: origin.origin + '/workspace-discovery?billing=verification',
    cancel_return_url: origin.origin + '/workspace-discovery?billing=cancelled',
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('PAYMENT_PROVIDER_CHECKOUT_UNAVAILABLE');
  const session = await response.json() as VerifiedSession;
  if (!session.payment_session_id || !session.payment_link_url || !isCheckoutUrl(session.payment_link_url) ||
      session.reference_id !== input.orderId || session.amount !== apiAmount || session.currency !== 'PHP') {
    throw new Error('PAYMENT_PROVIDER_INVALID_CHECKOUT');
  }
  return {
    id: session.payment_session_id,
    url: session.payment_link_url,
    expiresAt: session.expires_at ? new Date(session.expires_at) : new Date(Date.now() + 30 * 60000),
  };
}

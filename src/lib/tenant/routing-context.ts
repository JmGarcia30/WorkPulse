import { createHmac, timingSafeEqual } from 'node:crypto';
import { classifyRequestHost, requestAuthority } from './host';

export const ROUTING_CONTEXT_HEADER = 'x-workpulse-routing-context';
type RoutingContext = { organizationId: string; slug: string; host: string; issuedAt: number; mode: 'subdomain' | 'saga-path' | 'shared-path' };
function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') throw Error('SESSION_SECRET must contain at least 32 characters for trusted workspace routing.');
  return 'workpulse_development_only_session_secret_32bytes';
}
const signature = (payload: string) => createHmac('sha256', signingKey()).update('workpulse-routing-v1:' + payload).digest('base64url');
export function signRoutingContext(input: Omit<RoutingContext, 'issuedAt'>) {
  const payload = Buffer.from(JSON.stringify({ ...input, issuedAt: Date.now() })).toString('base64url');
  return payload + '.' + signature(payload);
}
export function readRoutingContext(requestHeaders: Headers): RoutingContext | null {
  const raw = requestHeaders.get(ROUTING_CONTEXT_HEADER);
  if (!raw || raw.length > 2048) return null;
  const [payload, supplied, extra] = raw.split('.');
  if (!payload || !supplied || extra || !/^[\w-]+$/.test(supplied)) return null;
  const expected = Buffer.from(signature(payload)), actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const context = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as RoutingContext;
    const host = requestAuthority(requestHeaders), classification = classifyRequestHost(requestHeaders);
    if (!host || context.host !== host || typeof context.organizationId !== 'string' || !context.organizationId || typeof context.slug !== 'string' || !Number.isFinite(context.issuedAt) || context.issuedAt > Date.now() + 1000 || Date.now() - context.issuedAt > 300000) return null;
    if (context.mode === 'saga-path') return classification.kind === 'public' && context.slug === 'st-aloysius' ? context : null;
    if (context.mode === 'shared-path') return classification.kind === 'public' && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(context.slug) && context.slug !== 'st-aloysius' ? context : null;
    return context.mode === 'subdomain' && classification.kind === 'tenant' && (classification.slug === 'saga' ? 'st-aloysius' : classification.slug) === context.slug ? context : null;
  } catch { return null; }
}

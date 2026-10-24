import 'server-only';
import MailComposer from 'nodemailer/lib/mail-composer';
import { z } from 'zod';
import { publicOrigin, parsePlatformHost } from '@/lib/tenant/host';
import { encryptionConfigured } from './crypto';

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GOOGLE_SCOPES = ['openid', 'email', GMAIL_SEND_SCOPE];
export class EmailIntegrationError extends Error {
  constructor(public readonly code: string, public readonly retrySeconds?: number) { super(code); }
}
export type Credentials = { accessToken: string; refreshToken: string; expiresAt: number };
export type EmailInlineLogo = { content: Buffer; contentType: string; cid: string };
export type GoogleGrant = Credentials & { email: string; subject: string };
export interface GmailProvider {
  exchange(code: string, verifier: string): Promise<GoogleGrant>;
  refresh(refreshToken: string): Promise<{ accessToken: string; expiresAt: number; refreshToken?: string }>;
  send(accessToken: string, raw: string): Promise<void>;
  revoke(token: string): Promise<boolean>;
}
export function googleConfiguration() {
  const clientId = process.env.GOOGLE_EMAIL_CLIENT_ID, clientSecret = process.env.GOOGLE_EMAIL_CLIENT_SECRET;
  const url = new URL(publicOrigin());
  if (!clientId || !clientSecret || !encryptionConfigured() || parsePlatformHost(url.host).kind !== 'public' || url.pathname !== '/' || url.search || url.hash || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) throw new EmailIntegrationError('SETUP_REQUIRED');
  return { clientId, clientSecret, callback: url.origin + '/api/email-integration/google/callback', origin: url.origin };
}
export function googleConfigured() { try { googleConfiguration(); return true; } catch { return false; } }
export function authorizationUrl(state: string, challenge: string) {
  const config = googleConfiguration(), url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callback, response_type: 'code', scope: GOOGLE_SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', state, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
  return url.href;
}
async function request(url: string, init: RequestInit) {
  try { return await fetch(url, { ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) }); }
  catch { throw new EmailIntegrationError('DELIVERY_UNCONFIRMED'); }
}
async function tokenRequest(params: Record<string, string>) {
  const config = googleConfiguration();
  const response = await request('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ ...params, client_id: config.clientId, client_secret: config.clientSecret }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new EmailIntegrationError(data.error === 'invalid_grant' ? 'RECONNECT_REQUIRED' : 'PROVIDER_UNAVAILABLE');
  const parsed = z.object({ access_token: z.string().min(1), expires_in: z.number().positive(), refresh_token: z.string().optional(), scope: z.string().optional(), token_type: z.literal('Bearer') }).safeParse(data);
  if (!parsed.success) throw new EmailIntegrationError('PROVIDER_UNAVAILABLE');
  return parsed.data;
}
export const googleProvider: GmailProvider = {
  async exchange(code, verifier) {
    const config = googleConfiguration();
    const token = await tokenRequest({ code, code_verifier: verifier, redirect_uri: config.callback, grant_type: 'authorization_code' });
    const scopes = new Set(token.scope?.split(' ') || []);
    if (!scopes.has(GMAIL_SEND_SCOPE) || !token.refresh_token) throw new EmailIntegrationError('CONSENT_REQUIRED');
    const response = await request('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + token.access_token } });
    const parsed = z.object({ sub: z.string().min(1), email: z.email(), email_verified: z.literal(true) }).safeParse(await response.json().catch(() => ({})));
    if (!response.ok || !parsed.success) throw new EmailIntegrationError('IDENTITY_UNVERIFIED');
    return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000, email: parsed.data.email.toLowerCase(), subject: parsed.data.sub };
  },
  async refresh(refreshToken) {
    const token = await tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' });
    if (token.scope && !token.scope.split(' ').includes(GMAIL_SEND_SCOPE)) throw new EmailIntegrationError('RECONNECT_REQUIRED');
    return { accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000 };
  },
  async send(accessToken, raw) {
    const response = await request('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }) });
    if (response.ok) return;
    const data = await response.json().catch(() => ({}));
    const reasons: string[] = (data.error?.errors || []).map((item: { reason?: string }) => item.reason || '');
    if (response.status === 401) throw new EmailIntegrationError('ACCESS_EXPIRED');
    if (response.status === 429 || reasons.some(reason => ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'mailSendingLimit'].includes(reason))) {
      const retry = Number(response.headers.get('retry-after'));
      throw new EmailIntegrationError('SENDING_LIMIT', Number.isFinite(retry) && retry > 0 ? Math.min(retry, 86400) : 900);
    }
    if (reasons.some(reason => ['insufficientPermissions', 'authError'].includes(reason))) throw new EmailIntegrationError('RECONNECT_REQUIRED');
    throw new EmailIntegrationError(response.status >= 500 ? 'DELIVERY_UNCONFIRMED' : 'SEND_FAILED');
  },
  async revoke(token) {
    try { return (await request('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token }) })).ok; } catch { return false; }
  },
};
export async function composeGmailMessage(input: { from: string; organizationName: string; to: string; subject: string; html: string; text?: string; inlineLogo?: EmailInlineLogo }) {
  if (!z.email().safeParse(input.from).success || !z.email().safeParse(input.to).success || /[\r\n]/.test(input.subject)) throw new EmailIntegrationError('INVALID_MESSAGE');
  const message = await new MailComposer({ from: { name: input.organizationName, address: input.from }, to: input.to, subject: input.subject, html: input.html, text: input.text, disableFileAccess: true, disableUrlAccess: true,
    attachments: input.inlineLogo ? [{ filename: 'organization-logo', content: input.inlineLogo.content, contentType: input.inlineLogo.contentType, cid: input.inlineLogo.cid, contentDisposition: 'inline' }] : undefined,
  }).compile().build();
  return message.toString('base64url');
}

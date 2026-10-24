import 'server-only';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { localStorageProvider } from '@/lib/storage';
import type { CompanyEmail } from './service';
import type { EmailInlineLogo } from './google';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);
const logoCid = 'workpulse-organization-logo';
const maxLogoBytes = 2 * 1024 * 1024;
const mimeTypes: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

export function publicEmailLogoUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export type EmailBranding = { name: string; slug: string; logoUrl?: string; inlineLogo?: EmailInlineLogo; timeZone?: string };
export type BrandedEmailContent = {
  subject: string; greeting: string; paragraphs: string[]; hrDepartment?: boolean;
  details?: { label: string; value: string }[]; action?: { label: string; url: string }; signature?: boolean;
};
export function emailOrganizationName(branding: EmailBranding) {
  return branding.slug === 'st-aloysius' ? 'St. Aloysius Gonzaga Academy' : branding.name.replace(/\s+/g, ' ').trim();
}
export function renderBrandedEmail(branding: EmailBranding, content: BrandedEmailContent): Omit<CompanyEmail, 'to'> {
  const name = emailOrganizationName(branding);
  const heading = branding.slug === 'st-aloysius' || content.hrDepartment ? name + ' – Human Resources Department' : name;
  const logo = branding.inlineLogo ? 'cid:' + branding.inlineLogo.cid : publicEmailLogoUrl(branding.logoUrl);
  const lines = (value: string) => escape(value).replace(/\r?\n/g, '<br/>');
  const actionUrl = publicEmailLogoUrl(content.action?.url);
  const details = (content.details || []).filter(item => item.value.trim());
  const signature = content.signature ? `Kind regards,\nHuman Resources Department\n${name}` : '';
  const actionText = actionUrl && content.action ? `${content.action.label}: ${actionUrl}` : '';
  const body = `<p style="margin:0 0 16px">${lines(content.greeting)}</p>${content.paragraphs.map(paragraph => `<p style="margin:0 0 16px">${lines(paragraph)}</p>`).join('')}${details.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px">${details.map(detail => `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;font-weight:600">${escape(detail.label)}</td><td style="padding:6px 0;vertical-align:top">${lines(detail.value)}</td></tr>`).join('')}</table>` : ''}${actionUrl && content.action ? `<p style="margin:0 0 20px"><a href="${escape(actionUrl)}" style="color:#17324d;font-weight:600;text-decoration:underline">${escape(content.action.label)}</a></p>` : ''}${signature ? `<p style="margin:20px 0 0">${lines(signature)}</p>` : ''}`;
  return {
    subject: content.subject.replace(/[\r\n]+/g, ' '),
    text: [heading, content.greeting, ...content.paragraphs, ...details.map(detail => `${detail.label}: ${detail.value}`), actionText, signature, 'Sent securely through WorkPulse'].filter(Boolean).join('\n\n'),
    html: `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f5f6f8;color:#243244;font-family:Arial,Helvetica,sans-serif"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px"><tr><td style="padding:28px 28px 22px;border-bottom:1px solid #e2e8f0">${logo ? `<img src="${escape(logo)}" alt="${escape(name)} logo" width="72" height="72" style="display:block;max-width:72px;height:auto;margin:0 0 16px;border:0" />` : ''}<h1 style="margin:0;font-size:20px;line-height:1.45;font-weight:600;color:#1e293b">${escape(heading)}</h1></td></tr><tr><td style="padding:24px 28px;font-size:15px;line-height:1.7">${body}</td></tr><tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.5">Sent securely through WorkPulse</td></tr></table></body></html>`,
    ...(branding.inlineLogo ? { inlineLogo: branding.inlineLogo } : {}),
  };
}

export function renderTestEmail(branding: EmailBranding): Omit<CompanyEmail, 'to'> {
  return renderBrandedEmail(branding, { subject: emailOrganizationName(branding) + ' — Email integration test', greeting: 'Hello,', paragraphs: ['This is a test email from your Human Resources team. Please confirm receipt to verify your organization’s connected Gmail account.'] });
}

function inlineImage(buffer: Buffer, contentType: string): EmailInlineLogo | undefined {
  return buffer.length > 0 && buffer.length <= maxLogoBytes && Object.values(mimeTypes).includes(contentType)
    ? { content: buffer, contentType, cid: logoCid } : undefined;
}
async function optionalStoredLogo(key: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const file = await Promise.race([
      localStorageProvider.get(key),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('LOGO_TIMEOUT')), 2000); }),
    ]);
    return inlineImage(file.buffer, file.contentType);
  } catch { return undefined; }
  finally { if (timer) clearTimeout(timer); }
}
async function optionalPublicFile(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  try {
    const pathname = decodeURIComponent(new URL(value, 'https://local.invalid').pathname);
    const root = await realpath(path.resolve('public'));
    const filename = await realpath(path.resolve(root, '.' + pathname));
    if (!filename.startsWith(root + path.sep)) return undefined;
    const contentType = mimeTypes[path.extname(filename).toLowerCase()];
    if (!contentType || (await stat(filename)).size > maxLogoBytes) return undefined;
    return inlineImage(await readFile(filename), contentType);
  } catch { return undefined; }
}

export async function organizationEmailBranding(tx: Pick<Prisma.TransactionClient, 'organization'>, organizationId: string): Promise<EmailBranding> {
  const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: {
    id: true, name: true, slug: true, logoUrl: true, timeZone: true,
    branding: { select: { displayName: true, logoStorageKey: true } },
  } });
  let inlineLogo: EmailInlineLogo | undefined;
  const key = org.branding?.logoStorageKey;
  // Uploaded logos are private. Read only the selected tenant's namespace and
  // embed bytes, never a private storage key or an authenticated image endpoint.
  if (key) {
    const prefix = [`branding-${org.id}/`, `workpulse/branding-${org.id}/`].find(value => key.startsWith(value));
    if (prefix && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(key.slice(prefix.length))) inlineLogo = await optionalStoredLogo(key);
  }
  const publicLogo = publicEmailLogoUrl(org.logoUrl);
  if (!inlineLogo && !publicLogo && org.logoUrl) inlineLogo = await optionalPublicFile(org.logoUrl);
  return { name: org.branding?.displayName?.trim() || org.name, slug: org.slug, logoUrl: publicLogo, inlineLogo, timeZone: org.timeZone };
}
export async function organizationTestEmail(tx: Prisma.TransactionClient, organizationId: string) {
  return renderTestEmail(await organizationEmailBranding(tx, organizationId));
}

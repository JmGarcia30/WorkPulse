import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { requireEmailAdministrator } from '@/features/email-integration/authorization';
import { organizationEmailBranding } from '@/features/email-integration/test-email-template';
import { HR_EMAIL_TYPES, HR_EMAIL_LABELS, mockHrEmailDetails, renderHrEmail, type HrEmailType } from '@/features/email-integration/hr-templates';

export default async function HrEmailPreviewsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  let actor; try { actor = await requireEmailAdministrator(); } catch { notFound(); }
  const requested = (await searchParams).type;
  const type: HrEmailType = HR_EMAIL_TYPES.includes(requested as HrEmailType) ? requested as HrEmailType : 'acknowledgment';
  const branding = await organizationEmailBranding(prisma, actor.organizationId);
  const message = renderHrEmail(branding, type, mockHrEmailDetails());
  const html = message.inlineLogo ? message.html.replace('cid:' + message.inlineLogo.cid, `data:${message.inlineLogo.contentType};base64,${message.inlineLogo.content.toString('base64')}`) : message.html;
  const base = await requestWorkspacePath('/dashboard/settings/email-integration/templates');
  return <div className="max-w-4xl space-y-5"><header className="space-y-2"><p className="wp-eyebrow">Email Integration</p><h1 className="wp-page-title">HR email previews</h1><p className="text-sm text-[var(--wp-text-muted)]">Preview your organization’s branding with fictional people and sample details. Opening or switching previews sends no emails and changes no records.</p></header>
    <Link className="text-sm underline" href={await requestWorkspacePath('/dashboard/settings/email-integration')}>Back to Email Integration</Link>
    <nav aria-label="HR email templates" className="flex flex-wrap gap-2">{HR_EMAIL_TYPES.map(item => <Link className={item === type ? 'wp-button-primary' : 'wp-button-secondary'} key={item} href={`${base}?type=${item}`} aria-current={item === type ? 'page' : undefined}>{HR_EMAIL_LABELS[item]}</Link>)}</nav>
    <section className="wp-card space-y-3 p-4"><h2 className="font-semibold">{HR_EMAIL_LABELS[type]}</h2><p className="break-words text-sm"><strong>Subject:</strong> {message.subject}</p><iframe title={`${HR_EMAIL_LABELS[type]} preview`} sandbox="" srcDoc={html} className="h-[680px] w-full rounded border bg-white" /></section>
    <details className="wp-card p-4"><summary className="cursor-pointer font-semibold">Plain-text alternative</summary><pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm">{message.text}</pre></details>
  </div>;
}

'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  organization: z.string().trim().min(2).max(160),
  message: z.string().trim().min(10).max(2000),
  website: z.string().max(0),
});

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character] ?? character);

export async function requestDemoAction(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(
    ['name', 'email', 'organization', 'message', 'website'].map((key) => [key, String(formData.get(key) || '')]),
  ));

  if (!parsed.success) {
    const fields = Object.keys(parsed.error.flatten().fieldErrors).join(',');
    redirect(`/request-demo?error=invalid&fields=${encodeURIComponent(fields)}`);
  }

  const contact = process.env.DEMO_REQUEST_EMAIL || process.env.GMAIL_USER;
  if (!contact) {
    console.error('[WorkPulse Demo Request] Delivery is not configured: set DEMO_REQUEST_EMAIL or GMAIL_USER.');
    redirect('/request-demo?error=delivery');
  }

  const subjectOrganization = parsed.data.organization.replace(/[\r\n]+/g, ' ').trim();
  let delivered = false;

  try {
    const result = await sendEmail({
      to: contact,
      subject: `WorkPulse demo request — ${subjectOrganization}`,
      text: `${parsed.data.name} (${parsed.data.email})\nOrganization: ${parsed.data.organization}\n\n${parsed.data.message}`,
      html: `<p><strong>${escapeHtml(parsed.data.name)}</strong> (${escapeHtml(parsed.data.email)})</p><p>Organization: ${escapeHtml(parsed.data.organization)}</p><p>${escapeHtml(parsed.data.message).replace(/\n/g, '<br>')}</p>`,
    });
    delivered = result.success && result.mode === 'smtp';
  } catch (error) {
    console.error('[WorkPulse Demo Request] Delivery failed.', error instanceof Error ? error.message : 'Unknown error');
  }

  if (!delivered) {
    console.error('[WorkPulse Demo Request] The request was not delivered by the configured email provider.');
    redirect('/request-demo?error=delivery');
  }

  redirect('/request-demo?sent=1');
}

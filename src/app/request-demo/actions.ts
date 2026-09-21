'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
const schema = z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254), organization: z.string().trim().min(2).max(160), message: z.string().trim().min(10).max(2000), website: z.string().max(0) });
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
export async function requestDemoAction(formData: FormData) { const parsed = schema.safeParse(Object.fromEntries(['name', 'email', 'organization', 'message', 'website'].map(key => [key, String(formData.get(key) || '')]))); if (!parsed.success) redirect('/request-demo?error=invalid'); const contact = process.env.DEMO_REQUEST_EMAIL || process.env.GMAIL_USER; if (contact) await sendEmail({ to: contact, subject: `WorkPulse demo request — ${parsed.data.organization}`, html: `<p><strong>${escape(parsed.data.name)}</strong> (${escape(parsed.data.email)})</p><p>Organization: ${escape(parsed.data.organization)}</p><p>${escape(parsed.data.message)}</p>` }); redirect('/request-demo?sent=1'); }

'use server';
import { randomBytes } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireEmailAdministrator } from './authorization';
import { beginConnection, disconnectConnection, testConnection, setSagaRecruitmentSender } from './service';
import { EmailIntegrationError } from './google';
import { emailMessage } from './messages';
import { requestAuthority, publicOrigin } from '@/lib/tenant/host';
import { requestWorkspacePath } from '@/lib/tenant/server';

export type EmailFormState = { error?: string; success?: string };
const settings = '/dashboard/settings/email-integration';
function failure(error: unknown) { return { error: emailMessage(error instanceof EmailIntegrationError ? error.code : 'FAILED') }; }
export async function connectEmailAction(): Promise<EmailFormState> {
  let url: string;
  try {
    const actor = await requireEmailAdministrator(), proof = randomBytes(32).toString('base64url');
    const workspacePath = await requestWorkspacePath(settings);
    const origin = new URL(publicOrigin()).protocol + '//' + requestAuthority(await headers()) + (workspacePath.startsWith('/saga/') ? '/saga' : '');
    ({ url } = await beginConnection(prisma, actor, proof, origin));
    (await cookies()).set(process.env.NODE_ENV === 'production' ? '__Host-workpulse_email_tenant' : 'workpulse_email_tenant', proof, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 });
  } catch (error) { return failure(error); }
  redirect(url);
}
export async function testEmailAction(_state: EmailFormState, form: FormData): Promise<EmailFormState> {
  try {
    const result = await testConnection(prisma, await requireEmailAdministrator(), form.get('recipient'));
    revalidatePath(settings);
    return result.success ? { success: `Test email submitted to Gmail for ${result.recipient}. Check that inbox to confirm delivery.` } : { error: emailMessage(result.code) };
  } catch (error) { return failure(error); }
}
export async function disconnectEmailAction(_state: EmailFormState, form: FormData): Promise<EmailFormState> {
  try {
    const actor = await requireEmailAdministrator();
    if (form.get('confirmed') !== 'yes') return { error: 'Confirm that you want to disconnect this account.' };
    const result = await disconnectConnection(prisma, actor);
    revalidatePath(settings);
    return { success: result.revoked ? 'Gmail disconnected. Stored authorization was removed.' : 'Gmail disconnected locally and stored authorization removed. Google revocation could not be confirmed; remove WorkPulse access in your Google account’s security settings.' };
  } catch (error) { return failure(error); }
}

export async function sagaRecruitmentSenderAction(_state: EmailFormState, form: FormData): Promise<EmailFormState> {
  try {
    const actor = await requireEmailAdministrator();
    if (form.get('confirmed') !== 'yes') return { error: 'Confirm the recruitment sender change.' };
    const sender = form.get('sender');
    if (sender !== 'GMAIL' && sender !== 'LEGACY') return { error: 'Choose a valid recruitment sender.' };
    await setSagaRecruitmentSender(prisma, actor, sender === 'GMAIL');
    revalidatePath(settings);
    return { success: sender === 'GMAIL' ? 'SAGA recruitment now uses its tested Gmail connection. Platform emails are unchanged.' : 'SAGA recruitment now uses its existing legacy sender. The Gmail connection remains available.' };
  } catch (error) { return failure(error); }
}

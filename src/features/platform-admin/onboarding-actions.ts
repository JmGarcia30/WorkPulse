'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from './session';
import { requireRequestTenant } from '@/lib/tenant/server';
import { activateOrganizationAdministrator, createOrganization, manageAdministratorInvitation, OrganizationOnboardingError } from './onboarding';
import type { OnboardingFormState } from './onboarding-schema';

function failure(error: unknown): OnboardingFormState {
  if (error instanceof OrganizationOnboardingError) return { error: error.message, code: error.code };
  // A commit may already have succeeded before an email/status failure. Persisted request keys make retries safe.
  return { error: 'The operation could not be confirmed. Retry with the same form, or review organization details before issuing a new request.', code: 'RETRY_REQUIRED' };
}
export async function createOrganizationAction(_previous: OnboardingFormState, form: FormData): Promise<OnboardingFormState> {
  const actor = await requirePlatformAdministrator();
  let organizationId: string;
  try {
    const result = await createOrganization(prisma, actor.id, {
      name: String(form.get('name') ?? ''), slug: String(form.get('slug') ?? ''), contactEmail: String(form.get('contactEmail') ?? ''),
      timeZone: String(form.get('timeZone') ?? ''), administratorEmail: String(form.get('administratorEmail') ?? ''), requestKey: String(form.get('requestKey') ?? ''),
    });
    organizationId = result.organizationId;
  } catch (error) { return failure(error); }
  revalidatePath('/platform');
  redirect(`/platform/organizations/${organizationId}`);
}
export async function manageOrganizationInvitationAction(_previous: OnboardingFormState, form: FormData): Promise<OnboardingFormState> {
  const actor = await requirePlatformAdministrator();
  if (form.get('confirmed') !== 'yes') return { error: 'Confirm the invitation action before proceeding.' };
  const organizationId = String(form.get('organizationId') ?? '');
  const operation = form.get('operation');
  if (operation !== 'RESEND' && operation !== 'REVOKE') return { error: 'Choose resend or revoke.' };
  try {
    const result = await manageAdministratorInvitation(prisma, actor.id, { organizationId, action: operation, requestKey: String(form.get('requestKey') ?? '') });
    revalidatePath(`/platform/organizations/${organizationId}`);
    return result.warning ? { error: result.warning, code: 'DELIVERY_FAILED' } : { success: operation === 'REVOKE' ? 'Invitation revoked. Its activation link cannot be used.' : 'Invitation request recorded. Check delivery status below; a retry does not issue another link.' };
  } catch (error) { return failure(error); }
}
export async function activateOrganizationAdministratorAction(_previous: OnboardingFormState, form: FormData): Promise<OnboardingFormState> {
  const tenant = await requireRequestTenant();
  try {
    await activateOrganizationAdministrator(prisma, tenant.organizationId, {
      token: String(form.get('token') ?? ''), name: String(form.get('name') ?? ''), password: String(form.get('password') ?? ''), passwordConfirmation: String(form.get('passwordConfirmation') ?? ''),
    });
  } catch (error) { return failure(error); }
  // Activation proves possession of the email link; normal tenant authentication is still required.
  redirect('/login?activated=1');
}

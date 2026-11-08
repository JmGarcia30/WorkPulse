'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { configurePlan, submitSubscriptionRequest, reviewSubscriptionRequest, activateSubscription, grantSagaPro, expireSubscription } from './service';

type Result = { error?: string; success?: string };
const messages: Record<string, string> = {
  SUBSCRIPTION_REQUEST_ALREADY_PENDING: 'Your organization already has a pending request.',
  SUBSCRIPTION_REQUEST_ALREADY_REVIEWED: 'This request has already been reviewed. Refresh to see its status.',
  SUBSCRIPTION_REQUEST_NOT_FOUND: 'The request does not belong to the selected organization.',
  SUBSCRIPTION_PLAN_UNAVAILABLE: 'This plan is currently unavailable for requests.',
  SUBSCRIPTION_INVALID_DURATION: 'Select an explicit duration from 1 to 120 months.',
  SUBSCRIPTION_REJECTION_REASON_REQUIRED: 'Enter a reason for rejecting this request.',
  SUBSCRIPTION_REVIEW_PENDING_REQUEST_FIRST: 'Review the pending request before granting another term.',
  SUBSCRIPTION_EXISTING_PAID_TERM: 'Review the existing paid term before granting complimentary access.',
  SUBSCRIPTION_NOT_SAGA: 'The complimentary agreement is available only for SAGA.',
};
const failure = (error: unknown): Result => ({ error: error instanceof Error ? messages[error.message] ?? 'Could not save. Check the form values and try again.' : 'Could not save changes.' });
const value = (form: FormData, key: string) => String(form.get(key) ?? '');
function amount(form: FormData, key: string) {
  const raw = value(form, key).trim();
  if (!raw) return null;
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(raw)) throw new Error('INVALID_PRICE');
  return Math.round(Number(raw) * 100);
}
function refresh() {
  revalidatePath('/platform/subscriptions');
  revalidatePath('/dashboard', 'layout');
}
export async function configureSubscriptionPlanAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  try {
    const planTier = value(form, 'tier');
    if (planTier !== 'BASIC' && planTier !== 'PRO') return { error: 'Invalid plan.' };
    const rawLimit = value(form, 'maxEmployees').trim();
    await configurePlan(prisma, actor.id, {
      tier: planTier, description: value(form, 'description'), monthlyPriceMinor: amount(form, 'monthly'), yearlyPriceMinor: amount(form, 'yearly'),
      maxEmployees: rawLimit ? Number(rawLimit) : null, active: form.get('active') === 'yes',
      aiResumeParsing: form.get('aiResumeParsing') === 'yes', advancedAnalytics: form.get('advancedAnalytics') === 'yes',
      gmailIntegration: form.get('gmailIntegration') === 'yes', customBranding: form.get('customBranding') === 'yes',
    });
    refresh();
    return { success: 'Plan saved. Optional feature changes apply to current subscriptions; preserved legacy access remains available.' };
  } catch (error) { return failure(error); }
}
export async function requestSubscriptionAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requireBackOfficeContext();
  if (actor.role !== 'HR_ADMIN' && actor.role !== 'ORGANIZATION_ADMIN') throw new Error('SUBSCRIPTION_FORBIDDEN');
  try {
    // No client-supplied organization ID is read here.
    await submitSubscriptionRequest(prisma, actor, form.get('tier'));
    refresh();
    return { success: 'Request submitted for administrator review. Your current access is unchanged.' };
  } catch (error) { return failure(error); }
}
export async function reviewSubscriptionRequestAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  try {
    const decision = value(form, 'decision');
    if (decision !== 'APPROVED' && decision !== 'REJECTED') return { error: 'Select approve or reject.' };
    await reviewSubscriptionRequest(prisma, actor.id, { organizationId: value(form, 'organizationId'), requestId: value(form, 'requestId'),
      decision, durationMonths: decision === 'APPROVED' ? Number(form.get('durationMonths')) : undefined, reviewNote: value(form, 'reviewNote') });
    refresh();
    return { success: decision === 'APPROVED' ? 'Request approved and subscription activated. No payment recorded.' : 'Request rejected. Current access is unchanged.' };
  } catch (error) { return failure(error); }
}
export async function activateSubscriptionAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  try {
    const planTier = value(form, 'tier');
    if (planTier !== 'BASIC' && planTier !== 'PRO') return { error: 'Invalid plan.' };
    if (form.get('confirmation') !== 'CONFIRM_TERM') return { error: 'Confirm the selected term and any plan replacement.' };
    await activateSubscription(prisma, actor.id, { organizationId: value(form, 'organizationId'), planTier,
      durationMonths: Number(form.get('durationMonths')), reviewNote: value(form, 'reviewNote') });
    refresh();
    return { success: 'Subscription term recorded as an administrator grant. No payment recorded.' };
  } catch (error) { return failure(error); }
}
export async function grantSagaComplimentaryProAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  if (form.get('confirmation') !== 'CONFIRM_SAGA_PRO') return { error: 'Confirm the SAGA Pro grant first.' };
  try {
    const outcome = await grantSagaPro(prisma, actor.id, value(form, 'organizationId'));
    refresh();
    return { success: outcome === 'ALREADY_GRANTED' ? 'SAGA already has active complimentary Pro.' : 'SAGA has complimentary Pro for two years. No payment recorded.' };
  } catch (error) { return failure(error); }
}
export async function expireSubscriptionAction(_previous: Result, form: FormData): Promise<Result> {
  const actor = await requirePlatformAdministrator();
  try {
    await expireSubscription(prisma, actor.id, value(form, 'organizationId'));
    refresh();
    return { success: 'Expiration status checked and recorded. Server access checks enforce the expiration date immediately.' };
  } catch (error) { return failure(error); }
}

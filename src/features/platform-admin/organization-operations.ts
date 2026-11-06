'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requirePlatformAdministrator } from './session';
import { z } from 'zod';

type ActionState = { error?: string; success?: string };
const email = z.email().max(254);
const organizationDetails = z.object({
  organizationId: z.string().min(1).max(128),
  name: z.string().trim().min(2).max(150),
  contactEmail: z.union([email, z.literal('')]),
  timeZone: z.string().trim().min(1).max(100).refine(value => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
  }, 'Enter an IANA time zone, for example Asia/Manila.'),
});
const careerStatus = z.object({
  organizationId: z.string().min(1).max(128),
  enabled: z.enum(['true', 'false']),
  confirmation: z.literal('yes'),
});

export async function saveOrganizationDetailsAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePlatformAdministrator();
  const parsed = organizationDetails.safeParse({
    organizationId: form.get('organizationId'), name: form.get('name'),
    contactEmail: form.get('contactEmail'), timeZone: form.get('timeZone'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check organization details.' };
  const input = parsed.data;
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.organization.findUnique({
        where: { id: input.organizationId },
        select: { id: true, name: true, contactEmail: true, timeZone: true },
      });
      if (!current) return 'Organization not found.';
      if (current.name === input.name && (current.contactEmail ?? '') === input.contactEmail && current.timeZone === input.timeZone) return 'No changes to save.';
      // Never change workspace slug, ownership, HR accounts or branding from this metadata form.
      await tx.organization.update({ where: { id: input.organizationId }, data: {
        name: input.name, contactEmail: input.contactEmail || null, timeZone: input.timeZone,
      } });
      await tx.platformOrganizationAudit.create({ data: {
        organizationId: input.organizationId, actorAdministratorId: actor.id,
        action: 'ORGANIZATION_DETAILS_UPDATED',
      } });
      return null;
    });
    if (result) return result === 'No changes to save.' ? { success: result } : { error: result };
    revalidatePath('/platform');
    revalidatePath(`/platform/organizations/${input.organizationId}`);
    return { success: 'Organization details saved. Workspace URL and HR data were not changed.' };
  } catch {
    return { error: 'Could not save the change. Try again or contact the platform operator.' };
  }
}

export async function changeCareerPortalAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const actor = await requirePlatformAdministrator();
  const parsed = careerStatus.safeParse({
    organizationId: form.get('organizationId'),
    enabled: form.get('enabled'),
    confirmation: form.get('confirmation'),
  });
  if (!parsed.success) return { error: 'Confirm the career portal change before saving.' };
  const { organizationId } = parsed.data;
  const enabled = parsed.data.enabled === 'true';
  try {
    const result = await prisma.$transaction(async tx => {
      const current = await tx.organization.findUnique({ where: { id: organizationId }, select: { careersEnabled: true } });
      if (!current) return 'Organization not found.';
      if (current.careersEnabled === enabled) return 'Career portal is already in the requested state.';
      await tx.organization.update({ where: { id: organizationId }, data: { careersEnabled: enabled } });
      await tx.platformOrganizationAudit.create({ data: {
        organizationId, actorAdministratorId: actor.id,
        action: enabled ? 'CAREER_PORTAL_ENABLED' : 'CAREER_PORTAL_DISABLED',
      } });
      return null;
    });
    if (result) return { success: result };
    revalidatePath('/platform');
    revalidatePath(`/platform/organizations/${organizationId}`);
    revalidatePath('/careers');
    return { success: enabled ? 'Career portal enabled.' : 'Career portal disabled. Existing jobs and applications were preserved.' };
  } catch {
    return { error: 'Could not change the career portal status.' };
  }
}


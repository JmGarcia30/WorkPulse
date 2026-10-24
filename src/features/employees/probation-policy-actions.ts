'use server';

import { revalidatePath } from 'next/cache';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageEmploymentLifecycle } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { isSagaProbationOrganization, organizationProbationPolicySchema } from './probation-policy';

export async function saveOrganizationProbationPolicy(input: unknown) {
  const user = await requireBackOfficeContext();
  if (!canManageEmploymentLifecycle(user)) return { error: 'Only HR/Admin can configure probation policies.' };
  const actor = await prisma.user.findFirst({ where: { id: user.userId, organizationId: user.organizationId, role: { in: ['ORGANIZATION_ADMIN', 'HR_ADMIN'] } }, select: { id: true } });
  if (!actor) return { error: 'Current HR/Admin permission is required.' };
  const organization = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { id: true, slug: true } });
  if (!organization) return { error: 'Organization not found.' };
  if (isSagaProbationOrganization(organization)) return { error: 'SAGA uses its approved institutional policy.' };
  const parsed = organizationProbationPolicySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid probation configuration.' };
  await prisma.organization.update({ where: { id: user.organizationId }, data: { probationPolicy: parsed.data } });
  revalidatePath('/dashboard/employees/probation-settings');
  return { success: true as const };
}

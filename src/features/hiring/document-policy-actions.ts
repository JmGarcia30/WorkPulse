'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { RecruitmentDocumentType } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getDocumentStaffContext } from './document-access';
import { hiringDocumentPolicySchema } from './document-policy';

export async function saveHiringDocumentPolicy(form: FormData) {
  const actor = await getDocumentStaffContext();
  if (!actor || !['ORGANIZATION_ADMIN', 'HR_ADMIN'].includes(actor.role)) throw Error('FORBIDDEN');
  const policy = Object.fromEntries(['TEACHING', 'NON_TEACHING'].map(category => [category,
    Object.values(RecruitmentDocumentType).filter(type => form.get(`${category}.${type}.enabled`) === 'on').map(type => {
      const prefix = `${category}.${type}.`;
      return { type, title: String(form.get(prefix+'title') || ''), description: String(form.get(prefix+'description') || ''),
        isRequired: form.get(prefix+'required') === 'on', isConditional: form.get(prefix+'conditional') === 'on',
        conditionalNote: String(form.get(prefix+'note') || ''), submissionTarget: String(form.get(prefix+'target') || '') };
    })]));
  const parsed = hiringDocumentPolicySchema.safeParse(policy);
  if (!parsed.success) redirect('/dashboard/hiring/settings?error=invalid');
  // No organization ID is accepted from the form or route.
  await prisma.organization.update({ where: { id: actor.organizationId }, data: { hiringDocumentRequirements: parsed.data } });
  revalidatePath('/dashboard/hiring', 'layout');
  redirect('/dashboard/hiring/settings?saved=1');
}

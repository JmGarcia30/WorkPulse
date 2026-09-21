'use server';

import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { localStorageProvider } from '@/lib/storage';
import { organizationBrandingSchema } from './schema';
import { validateBrandImage } from './assets';

function assertBrandingAdmin(role: Role) {
  if (role !== Role.ORGANIZATION_ADMIN && role !== Role.HR_ADMIN) throw new Error('FORBIDDEN');
}

export type BrandingActionState = { ok: boolean; message: string };

export async function updateBrandingAction(_: BrandingActionState, formData: FormData): Promise<BrandingActionState> {
  try {
    const actor = await requireBackOfficeContext();
    assertBrandingAdmin(actor.role);
    const parsed = organizationBrandingSchema.safeParse(Object.fromEntries(['displayName', 'tagline', 'primaryColor', 'accentColor', 'address', 'contactEmail', 'contactPhone'].map((key) => [key, String(formData.get(key) || '').trim()])));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || 'Check the branding values.' };
    await prisma.$transaction(async (tx) => {
      await tx.organizationBranding.upsert({ where: { organizationId: actor.organizationId }, create: { organizationId: actor.organizationId, ...parsed.data }, update: parsed.data });
      await tx.organizationBrandingAudit.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: 'BRANDING_UPDATED', details: { fields: Object.keys(parsed.data) } } });
    });
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Workspace branding updated.' };
  } catch (error) { return { ok: false, message: error instanceof Error && error.message !== 'FORBIDDEN' ? error.message : 'You are not allowed to update workspace branding.' }; }
}

export async function uploadBrandAssetAction(_: BrandingActionState, formData: FormData): Promise<BrandingActionState> {
  let uploadedKey: string | null = null;
  try {
    const actor = await requireBackOfficeContext(); assertBrandingAdmin(actor.role);
    const kind = formData.get('kind') === 'loginImage' ? 'loginImage' : 'logo';
    const file = formData.get('file');
    if (!(file instanceof File)) return { ok: false, message: 'Select an image.' };
    const image = await validateBrandImage(file, kind === 'logo' ? 2 * 1024 * 1024 : 5 * 1024 * 1024);
    const current = await prisma.organizationBranding.findUnique({ where: { organizationId: actor.organizationId } });
    const uploaded = await localStorageProvider.upload(image.buffer, image.fileName, image.mimeType, `branding-${actor.organizationId}`);
    uploadedKey = uploaded.storageKey;
    const field = kind === 'logo' ? 'logoStorageKey' : 'loginImageStorageKey';
    await prisma.$transaction(async (tx) => {
      await tx.organizationBranding.upsert({ where: { organizationId: actor.organizationId }, create: { organizationId: actor.organizationId, [field]: uploaded.storageKey }, update: { [field]: uploaded.storageKey } });
      await tx.organizationBrandingAudit.create({ data: { organizationId: actor.organizationId, actorUserId: actor.userId, action: kind === 'logo' ? 'LOGO_REPLACED' : 'LOGIN_IMAGE_REPLACED' } });
    });
    const oldKey = kind === 'logo' ? current?.logoStorageKey : current?.loginImageStorageKey;
    if (oldKey && oldKey !== uploaded.storageKey) await localStorageProvider.delete(oldKey);
    revalidatePath('/', 'layout');
    return { ok: true, message: `${kind === 'logo' ? 'Logo' : 'Login image'} updated.` };
  } catch (error) {
    if (uploadedKey) await localStorageProvider.delete(uploadedKey);
    return { ok: false, message: error instanceof Error && error.message !== 'FORBIDDEN' ? error.message : 'Unable to upload this image.' };
  }
}

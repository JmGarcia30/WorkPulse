import { z } from 'zod';
import { platformEmail, platformName, platformPassword } from '@/features/platform-admin/credentials';
import { workspaceSlug } from '@/features/platform-admin/onboarding-schema';

export const companyRegistration = z.object({
  companyName: z.string().trim().min(2, 'Enter a company name of at least 2 characters.').max(150),
  administratorName: platformName,
  email: platformEmail,
  password: platformPassword,
});
export type RegistrationInput = z.infer<typeof companyRegistration>;
export type RegistrationState = { error?: string; success?: string; email?: string };

export function companySlugBase(name: string) {
  const base = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  return workspaceSlug.safeParse(base).success ? base : 'company';
}

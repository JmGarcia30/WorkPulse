import { z } from 'zod';
import { RESERVED_SUBDOMAINS } from '@/lib/tenant/host';
import { platformEmail } from './credentials';

const reserved = new Set([...RESERVED_SUBDOMAINS, 'saga', 'st-aloysius', 'platform', 'register', 'login', 'dashboard', 'employee', 'careers', 'activate', 'workspace-discovery']);
export const workspaceSlug = z.string().trim().toLowerCase().min(2).max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Use lowercase letters, numbers and internal hyphens only.')
  .refine(value => !reserved.has(value), 'This workspace identifier is reserved.');
export const organizationCreation = z.object({
  name: z.string().trim().min(2).max(150),
  slug: workspaceSlug,
  contactEmail: platformEmail,
  timeZone: z.string().trim().max(100).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); return true; } catch { return false; } }, 'Enter a valid IANA timezone, such as Asia/Manila.'),
  administratorEmail: platformEmail,
  requestKey: z.uuid(),
});
export type OrganizationCreationInput = z.infer<typeof organizationCreation>;
export type OnboardingFormState = { error?: string; success?: string; code?: string };

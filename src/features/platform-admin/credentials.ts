import { z } from 'zod';

export const platformEmail = z.string().trim().toLowerCase().pipe(z.email().max(254));
// bcrypt consumes at most 72 bytes. Never accept silently truncated passwords.
export const platformPassword = z.string().min(14, 'Use at least 14 characters.').max(72)
  .refine(value => new TextEncoder().encode(value).length <= 72, 'Use at most 72 UTF-8 bytes.');
export const platformName = z.string().trim().min(2).max(100);
export type PlatformFormState = { error?: string; success?: string };

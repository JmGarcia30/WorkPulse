import { z } from 'zod';

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);
export const brandColorSchema = z.string().trim().toUpperCase().regex(/^#[0-9A-F]{6}$/, 'Use a six-digit hex color such as #17324D.');

export const organizationBrandingSchema = z.object({
  displayName: optionalText(120),
  tagline: optionalText(180),
  primaryColor: brandColorSchema.nullable(),
  accentColor: brandColorSchema.nullable(),
  address: optionalText(500),
  contactEmail: z.union([z.literal(''), z.email().max(254)]).transform((value) => value || null),
  contactPhone: optionalText(50),
});

export function readableForeground(hex: string) {
  const values = [1, 3, 5].map((end) => Number.parseInt(hex.slice(end, end + 2), 16) / 255)
    .map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  return luminance > 0.42 ? '#142033' : '#FFFFFF';
}

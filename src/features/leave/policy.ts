import { z } from 'zod';

export const categoryOptionsSchema = z.array(z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/),
  label: z.string().min(1).max(100),
})).max(20);

export const attestationRulesSchema = z.array(z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/),
  label: z.string().min(1).max(200),
  required: z.boolean().default(true),
  options: z.array(z.string().min(1).max(80)).max(20).optional(),
})).max(20);

export const documentRulesSchema = z.array(z.object({
  categoryCode: z.string().max(40).optional(),
  minimumUnits: z.number().positive().optional(),
  kindCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/),
  label: z.string().min(1).max(120),
  satisfaction: z.enum(['DOCUMENT_REQUIRED', 'DOCUMENT_OR_HR_VERIFICATION']),
})).max(20);

export type CategoryOption = z.infer<typeof categoryOptionsSchema>[number];
export type AttestationRule = z.infer<typeof attestationRulesSchema>[number];
export type DocumentRule = z.infer<typeof documentRulesSchema>[number];

export function parseLeavePolicy(input: {
  requestCategoryOptions: unknown;
  attestationRules: unknown;
  documentRules: unknown;
}) {
  return {
    categories: categoryOptionsSchema.parse(input.requestCategoryOptions),
    attestations: attestationRulesSchema.parse(input.attestationRules),
    documents: documentRulesSchema.parse(input.documentRules),
  };
}

export function applicableDocumentRules(
  rules: DocumentRule[],
  categoryCode: string | null,
  requestedUnits: number,
) {
  return rules.filter((rule) =>
    (!rule.categoryCode || rule.categoryCode === categoryCode) &&
    (!rule.minimumUnits || requestedUnits >= rule.minimumUnits)
  );
}

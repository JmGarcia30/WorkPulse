import { z } from 'zod';
import { EmploymentCategory, EmploymentStatus, PayFrequency } from '@prisma/client';
import { parseInstitutionalDate } from './domain';

const text = (limit: number) => z.string().trim().min(1).max(limit);
export const employeeRegistrationSchema = z.object({
  registrationKey: z.uuid(), firstName: text(100), lastName: text(100),
  email: z.email().max(254).transform(value => value.trim().toLowerCase()), phone: text(40),
  employeeNumber: text(64).transform(value => value.toUpperCase()), department: text(120), jobTitle: text(160),
  startDate: z.string().transform((value, ctx) => {
    try { const date = parseInstitutionalDate(value,'Employment date'); if (date > new Date()) throw new Error('Existing employee dates cannot be in the future.'); return date; }
    catch (error) { ctx.addIssue({ code:'custom', message: error instanceof Error ? error.message : 'Invalid date.' }); return z.NEVER; }
  }),
  employeeStatus: z.enum(['ACTIVE','INACTIVE']), employmentStatus: z.nativeEnum(EmploymentStatus),
  employmentCategory: z.nativeEnum(EmploymentCategory), employmentType: text(100),
  salary: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/,'Enter a valid contract salary.').refine(value => Number(value) > 0,'Contract salary must be positive.'),
  payFrequency: z.nativeEnum(PayFrequency), role: z.enum(['EMPLOYEE','HR_ADMIN','FINANCE_OFFICER','ORGANIZATION_HEAD']),
  existingUserId: z.string().trim().max(200).optional(), sendInvitation: z.boolean(),
  probationEndDate: z.string().trim().max(10).optional(), probationStandardsConfirmed: z.boolean(),
  registrationReason: text(1000),
});

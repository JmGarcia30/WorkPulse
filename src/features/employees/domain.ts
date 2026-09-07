import { EmploymentCategory, ProbationStatus } from '@prisma/client';

export const PROBATION_ENDING_SOON_DAYS = 30;

export type ProbationReviewState =
  | 'ACTIVE'
  | 'ENDING_SOON'
  | 'REVIEW_DUE'
  | 'OVERDUE_FOR_REVIEW'
  | 'CLOSED';

export interface ProbationReviewSummary {
  state: ProbationReviewState;
  daysRemaining: number;
  needsAttention: boolean;
  decisionAllowed: boolean;
}

export interface InitialProbationTerms {
  expectedEndAt: Date;
  renewalCount: number;
  maxRenewals: number;
  policySnapshot: string;
}

export function addCalendarMonthsClamped(source: Date, months: number): Date {
  const result = new Date(source);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return result;
}

export function addCalendarYearsClamped(source: Date, years: number): Date {
  return addCalendarMonthsClamped(source, years * 12);
}

export function utcStartOfDay(source: Date): Date {
  return new Date(
    Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate())
  );
}

export function parseInstitutionalDate(value: string, label: string): Date {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== trimmed
  ) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return parsed;
}

export function deriveProbationReviewState(input: {
  probationStatus: ProbationStatus;
  expectedEndAt: Date;
  asOf?: Date;
}): ProbationReviewSummary {
  if (input.probationStatus === ProbationStatus.CLOSED) {
    return {
      state: 'CLOSED',
      daysRemaining: 0,
      needsAttention: false,
      decisionAllowed: false,
    };
  }

  const asOf = utcStartOfDay(input.asOf ?? new Date());
  const expectedEnd = utcStartOfDay(input.expectedEndAt);
  const daysRemaining = Math.round(
    (expectedEnd.getTime() - asOf.getTime()) / 86_400_000
  );

  if (daysRemaining < 0) {
    return {
      state: 'OVERDUE_FOR_REVIEW',
      daysRemaining,
      needsAttention: true,
      decisionAllowed: true,
    };
  }
  if (daysRemaining === 0) {
    return {
      state: 'REVIEW_DUE',
      daysRemaining,
      needsAttention: true,
      decisionAllowed: true,
    };
  }
  if (daysRemaining <= PROBATION_ENDING_SOON_DAYS) {
    return {
      state: 'ENDING_SOON',
      daysRemaining,
      needsAttention: true,
      decisionAllowed: false,
    };
  }
  return {
    state: 'ACTIVE',
    daysRemaining,
    needsAttention: false,
    decisionAllowed: false,
  };
}

export function resolveInitialProbationTerms(input: {
  category: EmploymentCategory;
  startDate: Date;
  teachingExpectedEndAt?: Date | null;
}): InitialProbationTerms {
  if (input.category === EmploymentCategory.TEACHING) {
    const expectedEndAt = input.teachingExpectedEndAt;
    if (!expectedEndAt || Number.isNaN(expectedEndAt.getTime())) {
      throw new Error(
        'The exact school-year probation end date is required for Teaching employment.'
      );
    }
    if (expectedEndAt <= input.startDate) {
      throw new Error(
        'The school-year probation end date must be after the employment start date.'
      );
    }

    return {
      expectedEndAt,
      renewalCount: 0,
      maxRenewals: 2,
      policySnapshot:
        'Teaching probationary appointment for one school year. Exact end date confirmed from the employment contract during H1 conversion. Renewable annually up to a maximum total probationary period of three school years; no automatic renewal or regularization.',
    };
  }

  return {
    expectedEndAt: addCalendarMonthsClamped(input.startDate, 6),
    renewalCount: 0,
    maxRenewals: 0,
    policySnapshot:
      'Non-Teaching probationary appointment for six calendar months. Completion does not cause automatic regularization.',
  };
}

export function normalizeEmployeeNumberPrefix(
  configuredPrefix: string | null | undefined,
  organizationSlug: string
): string {
  const configured = configuredPrefix?.trim().toUpperCase();
  const fallback = organizationSlug.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalized = (configured || fallback || 'EMP').replace(/[^A-Z0-9]/g, '');
  return normalized.slice(0, 12) || 'EMP';
}

export function formatEmployeeNumber(prefix: string, year: number, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
}

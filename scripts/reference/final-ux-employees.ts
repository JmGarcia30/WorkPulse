import { prisma } from '@/lib/db/prisma';
import {
  EmployeeStatus,
  EmploymentCategory,
  Prisma,
  ProbationDecision,
  ProbationStatus,
} from '@prisma/client';
import {
  deriveProbationReviewState,
  ProbationReviewState,
  PROBATION_ENDING_SOON_DAYS,
  utcStartOfDay,
} from '../../src/features/employees/domain';

export interface EmployeeDirectoryFilters {
  search?: string;
  category?: EmploymentCategory;
  status?: EmployeeStatus;
  needsReview?: boolean;
  page?: number;
  pageSize?: number;
}

export interface EmployeeDirectoryItem {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeStatus: EmployeeStatus;
  department: string | null;
  employmentCategory: EmploymentCategory | null;
  employmentStatus: import('@prisma/client').EmploymentStatus | null;
  probationReview: {
    state: ProbationReviewState;
    daysRemaining: number;
    needsAttention: boolean;
    decisionAllowed: boolean;
  } | null;
}

export interface PaginatedEmployeesResult {
  employees: EmployeeDirectoryItem[];
  totalCount: number;
  totalOrganizationEmployees: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getOrganizationEmployees(
  organizationId: string,
  filters: EmployeeDirectoryFilters = {}
): Promise<PaginatedEmployeesResult> {
  const search = filters.search?.trim();
  const asOf = new Date();
  const reviewCutoff = utcStartOfDay(asOf);
  reviewCutoff.setUTCDate(reviewCutoff.getUTCDate() + PROBATION_ENDING_SOON_DAYS);

  const rawPage = filters.page ?? 1;
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawPageSize = filters.pageSize ?? 10;
  const pageSize = Number.isInteger(rawPageSize) && rawPageSize > 0 ? rawPageSize : 10;

  const searchWords = search ? search.split(/\s+/).filter(Boolean) : [];
  const searchConditions = search
    ? [
        { employeeNumber: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        ...(searchWords.length > 1
          ? [
              {
                AND: [
                  { firstName: { contains: searchWords[0], mode: 'insensitive' as const } },
                  { lastName: { contains: searchWords.slice(1).join(' '), mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ]
    : undefined;

  const where = {
    organizationId,
    employeeStatus: filters.needsReview ? EmployeeStatus.ACTIVE : filters.status,
    OR: searchConditions,
    AND: [
      ...(filters.category
        ? [{ employmentRecords: { some: { employmentCategory: filters.category } } }]
        : []),
      ...(filters.needsReview
        ? [{
            employmentRecords: {
              some: {
                effectiveFrom: { lte: asOf },
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
                probation: {
                  is: {
                    probationStatus: ProbationStatus.ACTIVE,
                    decision: ProbationDecision.PENDING,
                    expectedEndAt: { lte: reviewCutoff },
                  },
                },
              },
            },
          }]
        : []),
    ],
  };

  const [totalOrganizationEmployees, totalCount] = await prisma.$transaction([
    prisma.employee.count({ where: { organizationId } }),
    prisma.employee.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const validatedPage = Math.min(page, totalPages);
  const skip = (validatedPage - 1) * pageSize;

  const employees = await prisma.employee.findMany({
    where,
    include: {
      employmentRecords: {
        orderBy: { effectiveFrom: 'desc' },
        include: { probation: true },
        take: 5,
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
    skip,
    take: pageSize,
  });

  const plainItems: EmployeeDirectoryItem[] = employees.map((employee) => {
    const activeRecord = employee.employmentRecords.find(
      (r) => r.effectiveFrom <= asOf && (r.effectiveTo === null || r.effectiveTo > asOf)
    );
    const currentRecord = activeRecord ?? employee.employmentRecords[0] ?? null;
    const probation = currentRecord?.probation;
    const probationReview = probation
      ? deriveProbationReviewState({
          probationStatus: probation.probationStatus,
          expectedEndAt: probation.expectedEndAt,
          asOf,
        })
      : null;

    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      employeeStatus: employee.employeeStatus,
      department: currentRecord?.department ?? null,
      employmentCategory: currentRecord?.employmentCategory ?? null,
      employmentStatus: currentRecord?.employmentStatus ?? null,
      probationReview,
    };
  });

  return {
    employees: plainItems,
    totalCount,
    totalOrganizationEmployees,
    page: validatedPage,
    pageSize,
    totalPages,
  };
}

export function getOrganizationEmployeeById(
  organizationId: string,
  employeeId: string
) {
  return prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
    include: {
      sourceApplication: {
        include: {
          onboarding: { include: { tasks: true } },
        },
      },
      employmentRecords: {
        orderBy: { effectiveFrom: 'desc' },
        include: {
          probation: true,
          acceptedOffer: true,
        },
      },
      probationRecords: {
        orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          decisionBy: { select: { name: true } },
        },
      },
      employmentDecisions: {
        orderBy: { decisionAt: 'desc' },
        include: { changedBy: { select: { name: true } } },
      },
      statusHistory: {
        orderBy: { createdAt: 'desc' },
        include: { changedBy: { select: { name: true } } },
      },
      employeeAccount: {
        include: {
          user: { select: { email: true } },
          audits: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      },
    },
  });
}

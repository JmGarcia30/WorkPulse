import { prisma } from '@/lib/db/prisma';
import {
  EmployeeStatus,
  EmploymentCategory,
  ProbationDecision,
  ProbationStatus,
} from '@prisma/client';
import { PROBATION_ENDING_SOON_DAYS, utcStartOfDay } from './domain';

export interface EmployeeDirectoryFilters {
  search?: string;
  category?: EmploymentCategory;
  status?: EmployeeStatus;
  needsReview?: boolean;
}

export function getOrganizationEmployees(
  organizationId: string,
  filters: EmployeeDirectoryFilters = {}
) {
  const search = filters.search?.trim();
  const asOf = new Date();
  const reviewCutoff = utcStartOfDay(asOf);
  reviewCutoff.setUTCDate(reviewCutoff.getUTCDate() + PROBATION_ENDING_SOON_DAYS);
  return prisma.employee.findMany({
    where: {
      organizationId,
      employeeStatus: filters.needsReview ? EmployeeStatus.ACTIVE : filters.status,
      OR: search
        ? [
            { employeeNumber: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
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
    },
    include: {
      employmentRecords: {
        where: {
          effectiveFrom: { lte: asOf },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        include: { probation: true },
        take: 1,
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
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
    },
  });
}

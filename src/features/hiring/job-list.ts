import 'server-only';
import { JobStatus, Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const JOB_PAGE_SIZE = 20;
export interface JobListParams { status?: unknown; search?: unknown; page?: unknown }

export async function getJobList(organizationId: string, params: JobListParams, db: Pick<PrismaClient, 'job'> = prisma) {
  const status = typeof params.status === 'string' && Object.values(JobStatus).includes(params.status as JobStatus)
    ? params.status as JobStatus : undefined;
  const search = typeof params.search === 'string' ? params.search.trim() : '';
  const requestedPage = typeof params.page === 'string' && /^[1-9]\d{0,8}$/.test(params.page) ? Number(params.page) : 1;
  const where: Prisma.JobWhereInput = {
    organizationId, ...(status ? { status } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { department: { contains: search, mode: 'insensitive' as const } }] } : {}),
  };
  const totalCount = await db.job.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / JOB_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const jobs = await db.job.findMany({
    where, take: JOB_PAGE_SIZE, skip: (page - 1) * JOB_PAGE_SIZE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, title: true, department: true, location: true, status: true, closingDate: true, _count: { select: { applications: true } } },
  });
  return { jobs, totalCount, totalPages, page, status, search };
}

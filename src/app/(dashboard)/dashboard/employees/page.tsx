import Link from 'next/link';
import { canManageEmploymentLifecycle } from '@/lib/permissions/rbac';
import { redirect } from 'next/navigation';
import { EmployeeStatus, EmploymentCategory } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { canViewEmployees } from '@/lib/permissions/rbac';
import { getOrganizationEmployees } from '@/features/employees/queries';
import { EmployeeDirectoryHeader } from '@/components/employees/EmployeeDirectoryHeader';
import { EmployeeDirectoryFilters } from '@/components/employees/EmployeeDirectoryFilters';
import { EmployeeDirectoryTable } from '@/components/employees/EmployeeDirectoryTable';
import { EmployeeDirectoryPagination } from '@/components/employees/EmployeeDirectoryPagination';

interface EmployeesPageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    status?: string;
    needsReview?: string;
    page?: string;
  }>;
}

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canViewEmployees(user)) redirect('/dashboard');

  const params = await searchParams;
  const category = Object.values(EmploymentCategory).includes(
    params.category as EmploymentCategory
  )
    ? (params.category as EmploymentCategory)
    : undefined;
  const status = Object.values(EmployeeStatus).includes(params.status as EmployeeStatus)
    ? (params.status as EmployeeStatus)
    : undefined;

  const rawPage = parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = 10;
  const needsReview = params.needsReview === '1';

  const {
    employees,
    totalCount,
    totalOrganizationEmployees,
    page: validatedPage,
    totalPages,
  } = await getOrganizationEmployees(user.organizationId, {
    search: params.search,
    category,
    status,
    needsReview,
    page,
    pageSize,
  });

  const hasActiveFilters = Boolean(
    params.search || category || status || needsReview
  );

  const exportQuery = new URLSearchParams({
    ...(params.search ? { search: params.search } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(needsReview ? { needsReview: '1' } : {}),
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <EmployeeDirectoryHeader totalEmployees={totalOrganizationEmployees} />{canManageEmploymentLifecycle(user) && <Link href="/dashboard/employees/probation-settings" className="inline-block text-sm font-semibold underline">Probation policy settings</Link>}

      <div><Link href={`/api/reports/employees?${exportQuery}`} className="wp-button-secondary" prefetch={false}>Export employee CSV</Link></div>

      {/* Search & Filter Toolbar */}
      <EmployeeDirectoryFilters
        initialSearch={params.search ?? ''}
        initialCategory={category ?? ''}
        initialStatus={status ?? ''}
        initialNeedsReview={needsReview}
      />

      {/* Directory Table / Mobile Cards Container */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        {/* Table on desktop, stacked cards on mobile */}
        <EmployeeDirectoryTable
          employees={employees}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Server-Side Pagination Controls */}
        <EmployeeDirectoryPagination
          totalCount={totalCount}
          page={validatedPage}
          pageSize={pageSize}
          totalPages={totalPages}
          filters={{
            search: params.search,
            category,
            status,
            needsReview,
          }}
        />
      </div>
    </div>
  );
}

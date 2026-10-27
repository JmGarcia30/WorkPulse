import { EmployeeStatus, EmploymentCategory } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { canViewEmployees } from '@/lib/permissions/rbac';
import { getOrganizationEmployees } from '@/features/employees/queries';
import { csvDocument, csvCell, fileResponse, MAX_CSV_ROWS } from '@/features/reports/export-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function invalid(message: string, status = 400) {
  return new Response(message, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function GET(request: Request) {
  // Session validation checks current persisted role and the actual request tenant.
  const user = await getSession();
  if (!user || !canViewEmployees(user)) return invalid('Not authorized to export employee records.', 403);
  const input = new URL(request.url).searchParams;
  const search = input.get('search') ?? '';
  const rawCategory = input.get('category') ?? '';
  const rawStatus = input.get('status') ?? '';
  const rawReview = input.get('needsReview') ?? '';
  if (search.length > 120 || (rawCategory && !Object.values(EmploymentCategory).includes(rawCategory as EmploymentCategory)) ||
      (rawStatus && !Object.values(EmployeeStatus).includes(rawStatus as EmployeeStatus)) ||
      (rawReview && rawReview !== '1')) return invalid('Invalid employee report filters.');
  const filters = {
    search,
    category: rawCategory ? rawCategory as EmploymentCategory : undefined,
    status: rawStatus ? rawStatus as EmployeeStatus : undefined,
    needsReview: rawReview === '1',
  };
  try {
    // Reuse the directory query, including its tenant and filter semantics.
    const first = await getOrganizationEmployees(user.organizationId, { ...filters, page: 1, pageSize: 250 });
    if (first.totalCount > MAX_CSV_ROWS) return invalid('Too many employees. Narrow the filters before exporting.', 413);
    const all = [...first.employees];
    for (let page = 2; page <= first.totalPages; page++) {
      const next = await getOrganizationEmployees(user.organizationId, { ...filters, page, pageSize: 250 });
      all.push(...next.employees);
    }
    const headers = ['Employee Number', 'First Name', 'Last Name', 'Email', 'Department', 'Employment Category', 'Employee Status', 'Employment Status', 'Probation Review'];
    const rows = all.map(employee => [
      employee.employeeNumber, employee.firstName, employee.lastName, employee.email,
      employee.department ?? '', employee.employmentCategory ?? '', employee.employeeStatus,
      employee.employmentStatus ?? '', employee.probationReview?.state ?? '',
    ]);
    return fileResponse(csvDocument(headers, rows), 'workpulse-employees.csv', 'csv');
  } catch {
    return invalid('Employee report could not be generated.', 500);
  }
}

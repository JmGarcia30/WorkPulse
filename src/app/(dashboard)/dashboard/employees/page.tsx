import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmployeeStatus, EmploymentCategory } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { canViewEmployees } from '@/lib/permissions/rbac';
import { getOrganizationEmployees } from '@/features/employees/queries';
import { deriveProbationReviewState } from '@/features/employees/domain';
import { Search, Users } from 'lucide-react';

interface EmployeesPageProps {
  searchParams: Promise<{ search?: string; category?: string; status?: string; needsReview?: string }>;
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
  const employees = await getOrganizationEmployees(user.organizationId, {
    search: params.search,
    category,
    status,
    needsReview: params.needsReview === '1',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Employee Directory</h1>
        <p className="text-xs text-slate-500">
          Active institutional employee identities and current employment terms
        </p>
      </div>

      <form className="grid gap-3 rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs sm:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            name="search"
            defaultValue={params.search ?? ''}
            placeholder="Search name, email, or employee number"
            className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] py-2.5 pl-10 pr-3 text-xs"
          />
        </div>
        <select
          name="category"
          defaultValue={category ?? ''}
          className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-3 py-2.5 text-xs font-semibold"
        >
          <option value="">All categories</option>
          <option value={EmploymentCategory.TEACHING}>Teaching</option>
          <option value={EmploymentCategory.NON_TEACHING}>Non-Teaching</option>
        </select>
        <label className="flex items-center gap-2 rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-3 py-2.5 text-xs font-semibold">
          <input type="checkbox" name="needsReview" value="1" defaultChecked={params.needsReview === '1'} />
          Needs probation review
        </label>
        <div className="flex gap-2">
          <select
            name="status"
            defaultValue={status ?? ''}
            className="min-w-0 flex-1 rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-3 py-2.5 text-xs font-semibold"
          >
            <option value="">All statuses</option>
            {Object.values(EmployeeStatus).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <button className="rounded-2xl bg-[#181A1C] px-4 text-xs font-bold text-white">
            Filter
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-3xl border border-[#E8EAED] bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E8EAED] bg-[#F8F9FA] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Employee Number</th>
                <th className="px-5 py-4">Department</th>
                <th className="px-5 py-4">Category</th>
                <th className="px-5 py-4">Classification</th>
                <th className="px-5 py-4">Probation review</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8EAED]">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <Users className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                    No employees found.
                  </td>
                </tr>
              ) : employees.map((employee) => {
                const employment = employee.employmentRecords[0];
                const probation = employment?.probation;
                const review = probation
                  ? deriveProbationReviewState({
                      probationStatus: probation.probationStatus,
                      expectedEndAt: probation.expectedEndAt,
                    })
                  : null;
                return (
                  <tr key={employee.id} className="hover:bg-[#F8F9FA]">
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/employees/${employee.id}`} className="font-bold hover:underline">
                        {employee.firstName} {employee.lastName}
                      </Link>
                      <p className="text-[11px] text-slate-500">{employee.email}</p>
                    </td>
                    <td className="px-5 py-4 font-bold">{employee.employeeNumber}</td>
                    <td className="px-5 py-4">{employment?.department ?? '—'}</td>
                    <td className="px-5 py-4">{employment?.employmentCategory.replace('_', '-') ?? '—'}</td>
                    <td className="px-5 py-4">{employment?.employmentStatus ?? '—'}</td>
                    <td className="px-5 py-4">
                      {review ? (
                        <span className={`rounded-full px-2.5 py-1 font-bold ${review.needsAttention ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                          {review.state.replaceAll('_', ' ')}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700">
                        {employee.employeeStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

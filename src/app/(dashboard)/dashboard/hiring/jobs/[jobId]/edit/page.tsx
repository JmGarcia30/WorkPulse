import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canManageJobs } from '@/lib/permissions/rbac';
import { updateJobAction } from '@/features/hiring/actions';
import { RequirementsBuilder } from '@/components/hiring/RequirementsBuilder';
import { ArrowLeft, Save } from 'lucide-react';

interface EditJobPageProps {
  params: Promise<{ jobId: string }>;
}

export default async function EditJobPage({ params }: EditJobPageProps) {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    redirect('/dashboard/hiring/jobs');
  }

  const { jobId } = await params;

  // Multi-tenant check
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: user.organizationId },
    include: { structuredReqs: true },
  });

  if (!job) {
    notFound();
  }

  const updateJobWithId = updateJobAction.bind(null, jobId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/dashboard/hiring/jobs/${jobId}`}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Edit Job Posting: {job.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Update job description, parameters, or structured requirement tags
          </p>
        </div>
      </div>

      <form action={updateJobWithId} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-2 dark:border-slate-800">
            Basic Information
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Job Title *
              </label>
              <input
                type="text"
                name="title"
                required
                defaultValue={job.title}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Department *
              </label>
              <input
                type="text"
                name="department"
                required
                defaultValue={job.department}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Employment Type *
              </label>
              <select
                name="employmentType"
                required
                defaultValue={job.employmentType}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Location *
              </label>
              <input
                type="text"
                name="location"
                required
                defaultValue={job.location}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Application Closing Date
              </label>
              <input
                type="date"
                name="closingDate"
                defaultValue={
                  job.closingDate ? new Date(job.closingDate).toISOString().split('T')[0] : ''
                }
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Detailed Descriptions */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-100 pb-2 dark:border-slate-800">
            Description & Responsibilities
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Job Overview / Description *
            </label>
            <textarea
              name="description"
              required
              rows={4}
              defaultValue={job.description}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Key Responsibilities
            </label>
            <textarea
              name="responsibilities"
              rows={4}
              defaultValue={job.responsibilities}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              General Qualifications
            </label>
            <textarea
              name="qualifications"
              rows={4}
              defaultValue={job.qualifications}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Structured Job Requirements Builder */}
        <RequirementsBuilder
          initialRequirements={job.structuredReqs.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.type,
            description: r.description || '',
            isRequired: r.isRequired,
          }))}
        />

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#181A1C] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

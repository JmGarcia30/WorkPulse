import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canManageJobs } from '@/lib/permissions/rbac';
import { createJobAction } from '@/features/hiring/actions';
import { RequirementsBuilder } from '@/components/hiring/RequirementsBuilder';
import { ArrowLeft, Save, Send } from 'lucide-react';

export default async function NewJobPage() {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    redirect('/dashboard/hiring/jobs');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/hiring/jobs"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Create New Job Posting
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fill in job opening details and add structured qualification criteria
          </p>
        </div>
      </div>

      <form action={createJobAction} className="space-y-6">
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
                placeholder="e.g. Senior STEM Educator"
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
                placeholder="e.g. Academic Affairs"
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
                placeholder="e.g. Main Campus - Quezon City"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Application Closing Date (Optional)
              </label>
              <input
                type="date"
                name="closingDate"
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
              placeholder="Provide a comprehensive summary of the job role..."
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
              placeholder="• Teach General Physics and Advanced Calculus&#10;• Maintain laboratory equipment..."
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
              placeholder="• Master degree in STEM field&#10;• Licensed Professional Teacher (LPT)..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Structured Job Requirements Builder */}
        <RequirementsBuilder />

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            name="status"
            value="DRAFT"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <Save className="h-4 w-4" />
            Save as Draft
          </button>
          <button
            type="submit"
            name="status"
            value="PUBLISHED"
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#181A1C] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
            Publish Job Immediately
          </button>
        </div>
      </form>
    </div>
  );
}

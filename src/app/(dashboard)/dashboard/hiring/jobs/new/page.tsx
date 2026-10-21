import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canManageJobs } from '@/lib/permissions/rbac';
import { createJobAction } from '@/features/hiring/actions';
import { RequirementsBuilder } from '@/components/hiring/RequirementsBuilder';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';

export default async function NewJobPage() {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    redirect('/dashboard/hiring/jobs');
  }

  return (
    <div className="min-w-0 max-w-4xl mx-auto space-y-6 [overflow-wrap:anywhere]">
      {/* Top Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Job Openings', href: '/dashboard/hiring/jobs' },
          { label: 'New Job' },
        ]}
        title={
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              href="/dashboard/hiring/jobs"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
              aria-label="Back to Job Openings"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="min-w-0 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Create New Job Posting
            </h1>
          </div>
        }
        description="Fill in job opening details and add structured qualification criteria"
      />

      <form action={createJobAction} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-md border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Basic Information
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Job Title *
              </label>
              <input aria-label="Job Title"
                type="text"
                name="title"
                required
                placeholder="e.g. Senior STEM Educator"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Department *
              </label>
              <input aria-label="Department"
                type="text"
                name="department"
                required
                placeholder="e.g. Academic Affairs"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Employment Type *
              </label>
              <select aria-label="Employment Type"
                name="employmentType"
                required
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Location *
              </label>
              <input aria-label="Location"
                type="text"
                name="location"
                required
                placeholder="e.g. Main Campus - Quezon City"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Application Closing Date (Optional)
              </label>
              <input aria-label="Application Closing Date (Optional)"
                type="date"
                name="closingDate"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>
          </div>
        </div>

        {/* Detailed Descriptions */}
        <div className="rounded-md border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Description & Responsibilities
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Job Overview / Description *
            </label>
            <textarea aria-label="Job Overview / Description"
              name="description"
              required
              rows={4}
              placeholder="Provide a comprehensive summary of the job role..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Key Responsibilities
            </label>
            <textarea aria-label="Key Responsibilities"
              name="responsibilities"
              rows={4}
              placeholder="• Teach General Physics and Advanced Calculus&#10;• Maintain laboratory equipment..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              General Qualifications
            </label>
            <textarea aria-label="General Qualifications"
              name="qualifications"
              rows={4}
              placeholder="• Master degree in STEM field&#10;• Licensed Professional Teacher (LPT)..."
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>
        </div>

        {/* Structured Job Requirements Builder */}
        <RequirementsBuilder />

        {/* Action Controls */}
        <div className="flex flex-col items-stretch justify-end gap-3 pt-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            name="status"
            value="DRAFT"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Save className="h-4 w-4" />
            Save as Draft
          </button>
          <button
            type="submit"
            name="status"
            value="PUBLISHED"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tenant-primary)] px-6 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
            Publish Job Immediately
          </button>
        </div>
      </form>
    </div>
  );
}

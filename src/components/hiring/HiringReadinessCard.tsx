'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import React, { useState, useTransition } from 'react';
import { ApplicationStatus, EmploymentCategory } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { HiringReadinessResult } from '@/features/hiring/readiness';
import { convertApplicationToEmployeeAction } from '@/features/employees/actions';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Lock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface HiringReadinessCardProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  readiness: HiringReadinessResult;
  canManage: boolean;
  currentStatus: ApplicationStatus;
  employmentCategory: EmploymentCategory;
  employeeId?: string | null;
}

export function HiringReadinessCard({
  applicationId,
  candidateName,
  jobTitle,
  readiness,
  canManage,
  currentStatus,
  employmentCategory,
  employeeId,
}: HiringReadinessCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [teachingExpectedEndAt, setTeachingExpectedEndAt] = useState('');

  const isHired = currentStatus === ApplicationStatus.HIRED;
  const isTerminal =
    currentStatus === ApplicationStatus.REJECTED ||
    currentStatus === ApplicationStatus.WITHDRAWN;

  const handleConfirmHire = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await convertApplicationToEmployeeAction(
        applicationId,
        employmentCategory === EmploymentCategory.TEACHING
          ? { teachingExpectedEndAt }
          : undefined
      );

      if (!('employeeId' in result)) {
        setActionError(result.error);
      } else {
        setShowConfirmModal(false);
        router.push(`/dashboard/employees/${result.employeeId}`);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
        {/* Card Header & Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-md ${
                isHired
                  ? 'bg-teal-50 text-teal-600 '
                  : readiness.isReadyToHire
                  ? 'bg-emerald-50 text-emerald-600 '
                  : 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]'
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--wp-text-muted)]">
                Hiring Readiness Gate
              </h3>
              <p className="text-sm font-semibold text-[var(--wp-text)]">
                Pre-Hire Verification Gate
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${readiness.badgeBg} ${readiness.badgeText}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {readiness.badgeLabel}
          </span>
        </div>

        {/* Action Error Notice */}
        {actionError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {/* State: Already Hired */}
        {isHired && (
          <div className="rounded-md border border-teal-200 bg-teal-50/70 p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 text-teal-800 font-bold">
              <UserCheck className="h-4 w-4" />
              <span>Candidate Successfully Hired</span>
            </div>
            <p className="text-teal-700 leading-relaxed">
              {candidateName} has cleared all hiring prerequisites and onboarding verifications.
              The recruitment lifecycle is complete and the compliance handoff package is prepared for
              Employee Core.
            </p>
            {employeeId ? (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/employees/${employeeId}`)}
                className="font-bold text-teal-800 underline underline-offset-2"
              >
                View Employee Record
              </button>
            ) : canManage ? (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="rounded-lg bg-teal-700 px-3 py-2 font-bold text-white hover:bg-teal-800"
              >
                Complete Employee Record
              </button>
            ) : null}
          </div>
        )}

        {/* State: Terminal (Rejected / Withdrawn) */}
        {isTerminal && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
            <p className="font-semibold text-slate-900">
              Application Lifecycle Inactive
            </p>
            <p>
              This candidate application is marked as {currentStatus.toLowerCase()}. Pre-employment verification is closed.
            </p>
          </div>
        )}

        {/* 5-Point Readiness Checklist (Active Candidates) */}
        {!isHired && !isTerminal && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mandatory Readiness Criteria
            </h4>

            <div className="space-y-2">
              {readiness.checklist.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-start justify-between rounded-md border p-3 text-sm transition-colors ${
                    item.isComplete
                      ? 'border-emerald-100 bg-emerald-50/40 '
                      : 'border-slate-200 bg-slate-50/80 '
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {item.isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`font-semibold ${
                          item.isComplete
                            ? 'text-slate-900 '
                            : 'text-slate-700 '
                        }`}
                      >
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.statusText}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold uppercase shrink-0 ${
                      item.isComplete
                        ? 'bg-emerald-100 text-emerald-700 '
                        : 'bg-amber-100 text-amber-700 '
                    }`}
                  >
                    {item.isComplete ? 'Complete' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            {/* Incomplete items callout */}
            {!readiness.isReadyToHire && readiness.unmetRequirements.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Remaining Requirements Before Hire</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-xs text-amber-800 pl-1">
                  {readiness.unmetRequirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ready to Hire Banner */}
            {readiness.isReadyToHire && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/90 p-4 text-sm text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>All Pre-Employment Requirements Verified!</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Candidate has satisfied all recruitment criteria, accepted the formal offer package,
                  and verified all mandatory onboarding documentation. The application is now fully eligible
                  for conversion to Hired.
                </p>
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-2">
              {readiness.isReadyToHire ? (
                <button
                  type="button"
                  disabled={!canManage || isPending}
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Hire Candidate</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-xs">
                      Hire action blocked until all mandatory onboarding requirements are verified.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-bold text-slate-400 cursor-not-allowed shrink-0"
                  >
                    Hire Candidate
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <DialogFrame label="Confirm candidate hire" onClose={() => setShowConfirmModal(false)} busy={isPending}>
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Confirm Candidate Hire
                </h4>
                <p className="text-sm text-slate-500">
                  Convert candidate to official employee
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to mark <strong>{candidateName}</strong> as{' '}
              <strong>Hired</strong> for the role of <strong>{jobTitle}</strong>?
            </p>

            {employmentCategory === EmploymentCategory.TEACHING && (
              <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                <span>Exact school-year probation end date</span>
                <input
                  type="date"
                  required
                  value={teachingExpectedEndAt}
                  onChange={(event) => setTeachingExpectedEndAt(event.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2"
                />
                <span className="block text-xs font-normal text-slate-500">
                  Confirm this date from the executed employment contract. H1 never converts a school year to 12 months.
                </span>
              </label>
            )}

            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-900">
                Handoff Package Summary:
              </p>
              <p>✓ All 5 hiring readiness criteria verified</p>
              <p>✓ Formal offer terms locked</p>
              <p>✓ Pre-employment onboarding documents archived</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowConfirmModal(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isPending ||
                  (employmentCategory === EmploymentCategory.TEACHING &&
                    !teachingExpectedEndAt)
                }
                onClick={handleConfirmHire}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {isPending ? 'Processing Hire...' : 'Confirm Hire'}
              </button>
            </div>
          </div>
        </DialogFrame>
      )}
    </>
  );
}

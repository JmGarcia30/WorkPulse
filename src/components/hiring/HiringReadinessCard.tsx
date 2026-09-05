'use client';

import React, { useState, useTransition } from 'react';
import { ApplicationStatus } from '@prisma/client';
import { HiringReadinessResult } from '@/features/hiring/readiness';
import { updateApplicationStatusAction } from '@/features/hiring/actions';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  Lock,
  ArrowRight,
  Sparkles,
  Briefcase,
  Calendar,
} from 'lucide-react';

interface HiringReadinessCardProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  readiness: HiringReadinessResult;
  canManage: boolean;
  currentStatus: ApplicationStatus;
}

export function HiringReadinessCard({
  applicationId,
  candidateName,
  jobTitle,
  readiness,
  canManage,
  currentStatus,
}: HiringReadinessCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isHired = currentStatus === ApplicationStatus.HIRED;
  const isTerminal =
    currentStatus === ApplicationStatus.REJECTED ||
    currentStatus === ApplicationStatus.WITHDRAWN;

  const handleConfirmHire = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await updateApplicationStatusAction(
        applicationId,
        ApplicationStatus.HIRED
      );

      if (result?.error) {
        setActionError(result.error);
      } else {
        setShowConfirmModal(false);
      }
    });
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
        {/* Card Header & Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                isHired
                  ? 'bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400'
                  : readiness.isReadyToHire
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-[#181A1C] text-white'
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                Hiring Readiness Gate
              </h3>
              <p className="text-sm font-extrabold text-[#181A1C] dark:text-slate-100">
                Pre-Hire Verification Gate
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${readiness.badgeBg} ${readiness.badgeText}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {readiness.badgeLabel}
          </span>
        </div>

        {/* Action Error Notice */}
        {actionError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
        )}

        {/* State: Already Hired */}
        {isHired && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 text-xs dark:border-teal-900 dark:bg-teal-950/40 space-y-2">
            <div className="flex items-center gap-2 text-teal-800 dark:text-teal-200 font-bold">
              <UserCheck className="h-4 w-4" />
              <span>Candidate Successfully Hired</span>
            </div>
            <p className="text-teal-700 dark:text-teal-300 leading-relaxed">
              {candidateName} has cleared all hiring prerequisites and onboarding verifications.
              The recruitment lifecycle is complete and the compliance handoff package is prepared for
              the upcoming Employee Management module.
            </p>
          </div>
        )}

        {/* State: Terminal (Rejected / Withdrawn) */}
        {isTerminal && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 space-y-1">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
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
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider dark:text-slate-300">
              Mandatory Readiness Criteria
            </h4>

            <div className="space-y-2">
              {readiness.checklist.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-start justify-between rounded-xl border p-3 text-xs transition-colors ${
                    item.isComplete
                      ? 'border-emerald-100 bg-emerald-50/40 dark:border-emerald-950/60 dark:bg-emerald-950/20'
                      : 'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {item.isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p
                        className={`font-semibold ${
                          item.isComplete
                            ? 'text-slate-900 dark:text-slate-100'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {item.label}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.statusText}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase shrink-0 ${
                      item.isComplete
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {item.isComplete ? 'Complete' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>

            {/* Incomplete items callout */}
            {!readiness.isReadyToHire && readiness.unmetRequirements.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Remaining Requirements Before Hire</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300 pl-1">
                  {readiness.unmetRequirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Ready to Hire Banner */}
            {readiness.isReadyToHire && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <span>All Pre-Employment Requirements Verified!</span>
                </div>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
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
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Hire Candidate</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-[11px]">
                      Hire action blocked until all mandatory onboarding requirements are verified.
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-400 cursor-not-allowed shrink-0 dark:bg-slate-800 dark:text-slate-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Confirm Candidate Hire
                </h4>
                <p className="text-xs text-slate-500">
                  Convert candidate to official employee
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to mark <strong>{candidateName}</strong> as{' '}
              <strong>Hired</strong> for the role of <strong>{jobTitle}</strong>?
            </p>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-200">
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
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmHire}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50"
              >
                {isPending ? 'Processing Hire...' : 'Confirm Hire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

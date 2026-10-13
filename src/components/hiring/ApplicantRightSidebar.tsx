'use client';

import React from 'react';
import {
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ApplicationStatus, EmploymentCategory } from '@prisma/client';
import { HiringReadinessResult } from '@/features/hiring/readiness';
import { StatusChangeDialog } from './StatusChangeDialog';
import { HiringReadinessCard } from './HiringReadinessCard';
import { ApplicantTabKey } from './ApplicantProfileTabs';

interface TimelineActivity {
  id: string;
  title: string;
  actor?: string;
  timestamp: Date | string;
  type?: string;
}

interface ApplicantRightSidebarProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  currentStatus: ApplicationStatus;
  employmentCategory: EmploymentCategory;
  employeeId?: string | null;
  readiness: HiringReadinessResult;
  canManageStatus: boolean;
  canManageReadiness: boolean;
  canViewEmployee: boolean;
  recentActivities: TimelineActivity[];
  stageName: string;
  stageNumber: number;
  totalStages: number;
  onSelectTab: (tab: ApplicantTabKey) => void;
}

export function ApplicantRightSidebar({
  applicationId,
  candidateName,
  jobTitle,
  currentStatus,
  employmentCategory,
  employeeId,
  readiness,
  canManageStatus,
  canManageReadiness,
  canViewEmployee,
  recentActivities,
  stageName,
  stageNumber,
  totalStages,
  onSelectTab,
}: ApplicantRightSidebarProps) {
  const isHired = currentStatus === ApplicationStatus.HIRED;
  const isTerminal =
    currentStatus === ApplicationStatus.REJECTED ||
    currentStatus === ApplicationStatus.WITHDRAWN;

  return (
    <aside aria-label="Candidate Readiness and Activity" className="space-y-5">
      {/* 1. Hiring Readiness Gate Card */}
      <HiringReadinessCard
        applicationId={applicationId}
        candidateName={candidateName}
        jobTitle={jobTitle}
        readiness={readiness}
        canManage={canManageReadiness}
        currentStatus={currentStatus}
        employmentCategory={employmentCategory}
        employeeId={canViewEmployee ? employeeId : undefined}
      />

      {/* 2. Institutional Status Change Controller (if authorized) */}
      {canManageStatus && !isHired && !isTerminal && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Stage Controller
              </h3>
              <p className="text-[11px] text-slate-400">
                Current: {stageName} (Stage {stageNumber} of {totalStages})
              </p>
            </div>
            <span className="text-xs text-slate-400">Authorized Action</span>
          </div>
          <StatusChangeDialog
            applicationId={applicationId}
            currentStatus={currentStatus}
          />
        </div>
      )}

      {/* 3. Compact Activity Timeline Feed */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-900">
              Activity Timeline
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onSelectTab('history')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2 cursor-pointer transition"
          >
            Full History
          </button>
        </div>

        {recentActivities.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No events recorded yet.</p>
        ) : (
          <div className="relative pl-3 space-y-3.5 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
            {recentActivities.slice(0, 5).map((act) => (
              <div key={act.id} className="relative flex items-start gap-2.5 text-xs">
                <div className="absolute -left-3.25 top-1 h-2 w-2 rounded-full bg-slate-400 ring-2 ring-white" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 leading-tight">
                    {act.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {act.actor ? `${act.actor} • ` : ''}
                    {new Date(act.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-1">
          <button
            type="button"
            onClick={() => onSelectTab('history')}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <span>View Complete Audit Trail</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}

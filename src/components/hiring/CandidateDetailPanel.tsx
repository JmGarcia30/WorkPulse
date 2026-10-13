'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { X, Mail, Phone, Briefcase, Calendar, ExternalLink, CheckCircle2 } from 'lucide-react';
import { MinimalStatusBadge } from './MinimalStatusBadge';

export interface CandidateDetailPanelData {
  id: string;
  applicationId: string;
  name: string;
  position: string;
  email: string;
  phone?: string | null;
  department?: string;
  appliedDate?: string;
  status: string;
  statusLabel?: string;
  avatarInitials: string;
  coverLetter?: string;
  checklist?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    isComplete: boolean;
  }>;
  checklistTitle?: string;
  stageDetails?: Array<{
    label: string;
    value: string;
  }>;
  workflowTabLabel?: string;
}

export interface CandidateDetailPanelProps {
  candidate: CandidateDetailPanelData;
  onClose: () => void;
  actionSlot?: React.ReactNode;
}

export function CandidateDetailPanel({
  candidate,
  onClose,
  actionSlot,
}: CandidateDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow'>('overview');

  const completedCount = candidate.checklist
    ? candidate.checklist.filter((item) => item.isComplete).length
    : 0;
  const totalChecklist = candidate.checklist ? candidate.checklist.length : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      {/* Header with Avatar, Name, and Close Button */}
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 font-bold text-sm text-slate-800 border border-slate-200/70 uppercase">
            {candidate.avatarInitials}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {candidate.name}
            </h2>
            <p className="text-xs font-semibold text-slate-600 truncate">
              {candidate.position}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Close details panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Contact Row */}
      <div className="py-3.5 border-b border-slate-100 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <a
            href={`mailto:${candidate.email}`}
            className="truncate hover:text-[var(--tenant-primary)] transition"
          >
            {candidate.email}
          </a>
        </div>
        {candidate.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <a
              href={`tel:${candidate.phone}`}
              className="truncate hover:text-[var(--tenant-primary)] transition"
            >
              {candidate.phone}
            </a>
          </div>
        )}
        {candidate.department && (
          <div className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{candidate.department}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-[var(--tenant-primary)] text-[var(--tenant-primary)]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('workflow')}
          className={`pb-2.5 text-xs font-bold transition border-b-2 -mb-px ${
            activeTab === 'workflow'
              ? 'border-[var(--tenant-primary)] text-[var(--tenant-primary)]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          {candidate.workflowTabLabel || 'Workflow'}
        </button>
      </div>

      {/* Panel Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {activeTab === 'overview' ? (
          <div className="space-y-4">
            {/* Stage & Dates Summary Box */}
            <div className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-200/60 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 font-medium">Current Stage</span>
                <MinimalStatusBadge status={candidate.status} label={candidate.statusLabel} />
              </div>
              {candidate.appliedDate && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium">Applied Date</span>
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {candidate.appliedDate}
                  </span>
                </div>
              )}
              {candidate.department && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                  <span className="text-slate-500 font-medium">Department</span>
                  <span className="font-semibold text-slate-800">{candidate.department}</span>
                </div>
              )}
            </div>

            {/* Custom Stage Details Key-Values */}
            {candidate.stageDetails && candidate.stageDetails.length > 0 && (
              <div className="rounded-xl border border-slate-200/60 p-3.5 space-y-2 text-xs">
                <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                  Stage Information
                </h4>
                {candidate.stageDetails.map((detail, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">{detail.label}</span>
                    <span className="font-semibold text-slate-800 text-right">{detail.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cover Letter / Statement */}
            {candidate.coverLetter && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700">Cover Letter</h4>
                <p className="text-xs text-slate-500 leading-relaxed rounded-xl bg-slate-50/60 p-3 border border-slate-200/50 max-h-36 overflow-y-auto font-normal">
                  {candidate.coverLetter}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Workflow Tab */
          <div className="space-y-4">
            {/* Checklist Section */}
            {candidate.checklist && candidate.checklist.length > 0 ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800">
                    {candidate.checklistTitle || 'Requirements Checklist'}
                  </h4>
                  <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                    {completedCount} of {totalChecklist} completed
                  </span>
                </div>

                <div className="space-y-2">
                  {candidate.checklist.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/30 p-2.5 transition"
                    >
                      <div className="pt-0.5 shrink-0">
                        {item.isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-medium ${
                            item.isComplete ? 'text-slate-800' : 'text-slate-600'
                          }`}
                        >
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{item.subtitle}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/60 p-6 text-center text-xs text-slate-500">
                <p>No specific checklist items configured for this stage.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2.5">
        <Link
          href={`/dashboard/hiring/applicants/${candidate.applicationId}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
        >
          <span>View Full Profile</span>
          <ExternalLink className="h-3 w-3 text-slate-400" />
        </Link>

        {actionSlot && <div className="shrink-0">{actionSlot}</div>}
      </div>
    </div>
  );
}

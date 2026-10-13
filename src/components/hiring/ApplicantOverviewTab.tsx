'use client';

import React from 'react';
import {
  Award,
  Clock,
  ArrowRight,
  FileCheck,
  Calendar,
  Layers,
} from 'lucide-react';
import { HiringReadinessResult } from '@/features/hiring/readiness';
import { ApplicantTabKey } from './ApplicantProfileTabs';
import { ParsedResumeSection } from './ParsedResumeSection';

interface StructuredRequirement {
  id: string;
  name: string;
  type: string;
  isRequired: boolean;
}

type ParsedResumeComponentProps = React.ComponentProps<typeof ParsedResumeSection>;

interface TimelineItem {
  id: string;
  title: string;
  actor?: string;
  timestamp: Date | string;
  type: string;
}

interface ApplicantOverviewTabProps {
  candidateName: string;
  jobTitle: string;
  department: string;
  location?: string | null;
  email: string;
  phone?: string | null;
  appliedAt: Date | string;
  source?: string;
  readiness: HiringReadinessResult;
  structuredReqs: StructuredRequirement[];
  parsedResume?: ParsedResumeComponentProps['parsedResume'];
  resumeDocumentId?: string | null;
  canManageResume?: boolean;
  verifiedDocsCount: number;
  totalDocsCount: number;
  interviewsCount: number;
  assessmentsCount: number;
  passedAssessmentsCount: number;
  recentHistory: TimelineItem[];
  onSelectTab: (tab: ApplicantTabKey) => void;
}

export function ApplicantOverviewTab({
  candidateName,
  jobTitle,
  department,
  location,
  email,
  phone,
  appliedAt,
  source = 'Online Application',
  readiness,
  structuredReqs,
  parsedResume,
  resumeDocumentId,
  canManageResume = false,
  verifiedDocsCount,
  totalDocsCount,
  interviewsCount,
  assessmentsCount,
  passedAssessmentsCount,
  recentHistory,
  onSelectTab,
}: ApplicantOverviewTabProps) {
  const formattedDate = new Date(appliedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Extract education from parsed resume if available
  const highestEducation = parsedResume?.education?.[0]
    ? `${parsedResume.education[0].degree} in ${parsedResume.education[0].fieldOfStudy || 'Education'}`
    : null;

  // Extract years of experience from parsed resume
  const yearsExperience = parsedResume?.totalExperienceYears
    ? `${parsedResume.totalExperienceYears}+ years`
    : null;

  // Extract specialization from education or first work role
  const specialization = parsedResume?.education?.[0]?.fieldOfStudy || jobTitle;

  return (
    <div className="space-y-6">
      {/* 1. Candidate Overview Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Candidate Overview
          </h2>
          <span className="text-xs font-medium text-slate-400">
            Profile Details
          </span>
        </div>

        {/* 2-Column Metadata Grid matching reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs sm:text-sm">
          {/* Left Column */}
          <div className="space-y-3">
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Full Name</span>
              <span className="text-slate-900 font-semibold text-right">{candidateName}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Position Applied</span>
              <span className="text-slate-900 font-semibold text-right">{jobTitle}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Department</span>
              <span className="text-slate-900 font-semibold text-right">{department}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Campus / Location</span>
              <span className="text-slate-900 font-semibold text-right">{location || 'Main Campus'}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Email</span>
              <span className="text-slate-900 font-semibold text-right truncate max-w-[200px]">{email}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Phone</span>
              <span className="text-slate-900 font-semibold text-right">{phone || 'Not provided'}</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-3">
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Application Date</span>
              <span className="text-slate-900 font-semibold text-right">{formattedDate}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Source</span>
              <span className="text-slate-900 font-semibold text-right">{source}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Years of Experience</span>
              <span className="text-slate-900 font-semibold text-right">{yearsExperience || 'Not recorded'}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Highest Education</span>
              <span className="text-slate-900 font-semibold text-right truncate max-w-[200px]">{highestEducation || 'Degree recorded'}</span>
            </div>
            <div className="flex items-start justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400 font-medium">Specialization</span>
              <span className="text-slate-900 font-semibold text-right truncate max-w-[200px]">{specialization}</span>
            </div>
          </div>
        </div>

        {/* Key Qualifications Section */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Key Qualifications & Skills
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {structuredReqs.length > 0 ? (
              structuredReqs.map((req) => (
                <div
                  key={req.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  <Award className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{req.name}</span>
                </div>
              ))
            ) : null}

            {parsedResume?.skills && parsedResume.skills.length > 0
              ? parsedResume.skills.slice(0, 8).map((skill, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    <span>{skill}</span>
                  </div>
                ))
              : null}

            {structuredReqs.length === 0 && (!parsedResume?.skills || parsedResume.skills.length === 0) && (
              <p className="text-xs text-slate-400 italic">No qualification criteria recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Full AI-Assisted Resume Analysis Section (Interactive with Gemini) */}
      {resumeDocumentId && (
        <ParsedResumeSection
          documentId={resumeDocumentId}
          parsedResume={parsedResume || null}
          jobRequirements={structuredReqs}
          canManage={canManageResume}
        />
      )}

      {/* 3. Current Requirements Summary */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Current Requirements Summary
          </h2>
          <span className="text-xs font-medium text-slate-400">
            Stage Milestones
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Documents Card */}
          <div
            onClick={() => onSelectTab('documents')}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Documents</span>
              <FileCheck className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold text-slate-900">
                {verifiedDocsCount} <span className="text-xs font-normal text-slate-500">/ {totalDocsCount} verified</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {verifiedDocsCount === totalDocsCount && totalDocsCount > 0
                  ? 'All mandatory documents verified'
                  : `${totalDocsCount - verifiedDocsCount} pending verification`}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-700">
              <span>View Documents</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          {/* Interviews Card */}
          <div
            onClick={() => onSelectTab('interviews')}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Interviews</span>
              <Calendar className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold text-slate-900">
                {interviewsCount} <span className="text-xs font-normal text-slate-500">scheduled</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {interviewsCount > 0 ? 'Evaluations in progress' : 'No interviews scheduled yet'}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-700">
              <span>View Interviews</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>

          {/* Assessments Card */}
          <div
            onClick={() => onSelectTab('assessments')}
            className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 hover:border-slate-300 hover:bg-slate-50 cursor-pointer transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Assessments</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2">
              <p className="text-lg font-bold text-slate-900">
                {passedAssessmentsCount} <span className="text-xs font-normal text-slate-500">/ {assessmentsCount} passed</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {assessmentsCount > 0 ? 'Teaching & skills tests' : 'No assessments assigned yet'}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-700">
              <span>View Assessments</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Readiness Unmet items alert */}
        {readiness.unmetRequirements.length > 0 && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-4 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>Outstanding Requirements Before Hire:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-700 pl-1">
              {readiness.unmetRequirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 4. Recent Activity Preview */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            Recent Activity
          </h2>
          <button
            type="button"
            onClick={() => onSelectTab('history')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline underline-offset-2 cursor-pointer transition"
          >
            View Full History
          </button>
        </div>

        {recentHistory.length === 0 ? (
          <p className="text-xs text-slate-400">No activity recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {recentHistory.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-xs">
                <div className="h-2 w-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="text-slate-400">
                    {item.actor ? `By ${item.actor} • ` : ''}
                    {new Date(item.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

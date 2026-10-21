'use client';

import React, { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ApplicantProfileHeader } from './ApplicantProfileHeader';
import { CandidateIdentityCard } from './CandidateIdentityCard';
import { HiringProgressTracker } from './HiringProgressTracker';
import { ApplicantProfileTabs, ApplicantTabKey } from './ApplicantProfileTabs';
import { ApplicantOverviewTab } from './ApplicantOverviewTab';
import { ApplicantDocumentsTab } from './ApplicantDocumentsTab';
import { ApplicantInterviewsTab } from './ApplicantInterviewsTab';
import { ApplicantAssessmentsTab } from './ApplicantAssessmentsTab';
import { ApplicantOffersTab } from './ApplicantOffersTab';
import { ApplicantOnboardingTab } from './ApplicantOnboardingTab';
import { ApplicantHistoryTab } from './ApplicantHistoryTab';
import { ApplicantRightSidebar } from './ApplicantRightSidebar';
import { CandidateInterviewsSection } from './CandidateInterviewsSection';
import { CandidateAssessmentsSection } from './CandidateAssessmentsSection';
import { CandidateOffersSection } from './CandidateOffersSection';
import { CandidateOnboardingSection } from './CandidateOnboardingSection';
import { STAGE_CONFIG } from '@/features/hiring/pipeline';
import { HiringReadinessResult } from '@/features/hiring/readiness';
import { ApplicationStatus } from '@prisma/client';

const VALID_TABS: ApplicantTabKey[] = [
  'overview',
  'documents',
  'interviews',
  'assessments',
  'offers',
  'onboarding',
  'history',
];

interface ApplicantProfileViewProps {
  application: {
    id: string;
    status: ApplicationStatus;
    appliedAt: Date | string;
    coverLetter?: string | null;
    applicant: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string | null;
    };
    job: {
      id: string;
      title: string;
      department: string;
      location?: string | null;
      category: 'TEACHING' | 'NON_TEACHING';
      structuredReqs?: Array<{
        id: string;
        name: string;
        type: string;
        isRequired: boolean;
      }>;
      organization?: {
        slug: string;
        name: string;
      };
    };
    documents: Array<{
      id: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      parsedResume?: {
        summary: string | null;
        skills: unknown;
        education: unknown;
        workExperience: unknown;
        totalExperienceYears: number | null;
        matchScore: number | null;
        matchDetails: unknown;
      } | null;
    }>;
    recruitmentDocuments: React.ComponentProps<typeof ApplicantDocumentsTab>['recruitmentDocuments'];
    interviews: Array<
      React.ComponentProps<typeof CandidateInterviewsSection>['interviews'][number] & {
        createdAt: Date | string;
        updatedAt: Date | string;
      }
    >;
    assessments: Array<
      React.ComponentProps<typeof CandidateAssessmentsSection>['assessments'][number] & {
        createdAt: Date | string;
        maxScore?: number | null;
        evaluatedAt?: Date | string | null;
      }
    >;
    offers: Array<
      React.ComponentProps<typeof CandidateOffersSection>['offers'][number] & {
        startDate: Date;
        createdAt: Date | string;
        updatedAt: Date | string;
      }
    >;
    onboarding: (React.ComponentProps<typeof CandidateOnboardingSection>['onboarding'] & {
      createdAt: Date | string;
    }) | null;
    history: React.ComponentProps<typeof ApplicantHistoryTab>['history'];
    employee?: { id: string } | null;
  };
  organizationUsers: React.ComponentProps<typeof ApplicantAssessmentsTab>['organizationEvaluators'];
  readiness: HiringReadinessResult;
  isSaga: boolean;
  initialTab?: string;
  permissions: {
    canEditStatus: boolean;
    canManageIv: boolean;
    canManageAss: boolean;
    canRecordScore: boolean;
    canManageOff: boolean;
    canApproveOff: boolean;
    canManageOnb: boolean;
    canManageJobs: boolean;
    canViewEmployees: boolean;
  };
}

export function ApplicantProfileView({
  application,
  organizationUsers,
  readiness,
  isSaga,
  initialTab = 'overview',
  permissions,
}: ApplicantProfileViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Validate tab
  const getValidatedTab = useCallback((tabValue?: string | null): ApplicantTabKey => {
    if (tabValue && VALID_TABS.includes(tabValue as ApplicantTabKey)) {
      return tabValue as ApplicantTabKey;
    }
    return 'overview';
  }, []);

  const queryTab = searchParams?.get('tab');
  const activeTab: ApplicantTabKey = queryTab
    ? getValidatedTab(queryTab)
    : getValidatedTab(initialTab);

  const handleTabChange = useCallback(
    (newTab: ApplicantTabKey) => {
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (newTab === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', newTab);
      }
      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(targetUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const candidateFullName = `${application.applicant.firstName} ${application.applicant.lastName}`;
  const avatarInitials = `${application.applicant.firstName[0] || ''}${application.applicant.lastName[0] || ''}`;

  const stageConfig = STAGE_CONFIG[application.status] || {
    label: application.status,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
  };

  // Find parsed resume data if present (or candidate resume document)
  const resumeDoc =
    application.documents.find((d) => d.parsedResume) ||
    application.documents.find(
      (d) => d.fileType === 'application/pdf' || d.fileType?.includes('wordprocessingml')
    ) ||
    application.documents[0];

  const parsedResume = resumeDoc?.parsedResume
    ? {
        summary: resumeDoc.parsedResume.summary,
        skills: (resumeDoc.parsedResume.skills as string[]) || [],
        education: (resumeDoc.parsedResume.education as Array<{
          institution: string;
          degree: string;
          fieldOfStudy: string;
          startDate: string;
          endDate: string;
        }>) || [],
        workExperience: (resumeDoc.parsedResume.workExperience as Array<{
          company: string;
          position: string;
          startDate: string;
          endDate: string;
          description: string;
        }>) || [],
        certifications: [],
        languages: [],
        totalExperienceYears: resumeDoc.parsedResume.totalExperienceYears,
        matchScore: resumeDoc.parsedResume.matchScore,
        matchDetails: (resumeDoc.parsedResume.matchDetails as Array<{
          requirementId: string;
          requirementName: string;
          requirementType: string;
          isRequired: boolean;
          matched: boolean;
          confidence: 'high' | 'medium' | 'low';
          evidence: string;
        }>) || null,
        parsedAt: new Date().toISOString(),
        parseError: null,
      }
    : null;

  // Compute metrics for tabs and overview
  const verifiedDocsCount = application.recruitmentDocuments.filter(
    (d) => d.status === 'VERIFIED'
  ).length;
  const totalDocsCount = application.recruitmentDocuments.length;
  const interviewsCount = application.interviews.length;
  const assessmentsCount = application.assessments.length;
  const passedAssessmentsCount = application.assessments.filter(
    (a) => a.status === 'PASSED'
  ).length;
  const offersCount = application.offers.length;
  const onboardingTaskCount = application.onboarding?.tasks?.length || 0;

  // Recent timeline events for quick activity lists
  const recentActivities = (application.history || []).map((h) => ({
    id: h.id,
    title: `Status changed from ${h.fromStatus} to ${h.toStatus}`,
    actor: h.changedBy?.name,
    timestamp: h.createdAt,
    type: 'status',
  }));

  if (recentActivities.length === 0) {
    recentActivities.push({
      id: 'app-init',
      title: 'Application Received',
      actor: candidateFullName,
      timestamp: application.appliedAt,
      type: 'applied',
    });
  }

  // Lifecycle check states
  const documentsSatisfied = readiness.checklist.find(
    (c) => c.key === 'documents'
  )?.isComplete;
  const writtenExamPassed = readiness.checklist.find(
    (c) => c.key === 'assessment'
  )?.isComplete;
  const teachingDemoSatisfactory = readiness.checklist.find(
    (c) => c.key === 'teaching_demo'
  )?.isComplete;
  const hodInterviewCompleted = readiness.checklist.find(
    (c) => c.key === 'hod_interview'
  )?.isComplete;
  const presidentInterviewCompleted = readiness.checklist.find(
    (c) => c.key === 'president_interview'
  )?.isComplete;
  const hasAcceptedOffer = application.offers.some(
    (o) => o.status === 'ACCEPTED'
  );

  return (
    <div className="mx-auto space-y-6">
      {/* 1. Page Header (Breadcrumbs, Title, Status Badges, Back Action) */}
      <ApplicantProfileHeader
        candidateName={candidateFullName}
        jobTitle={application.job.title}
        department={application.job.department}
        appliedAt={application.appliedAt}
        stageLabel={stageConfig.label}
        stageBadgeBg={stageConfig.badgeBg}
        stageBadgeText={stageConfig.badgeText}
        readinessLabel={readiness.badgeLabel}
        readinessBadgeBg={readiness.badgeBg}
        readinessBadgeText={readiness.badgeText}
        backHref="/dashboard/hiring/applicants"
      />

      {/* 2. Candidate Identity Card */}
      <CandidateIdentityCard
        candidateName={candidateFullName}
        avatarInitials={avatarInitials}
        jobTitle={application.job.title}
        department={application.job.department}
        location={application.job.location}
        category={application.job.category}
        email={application.applicant.email}
        phone={application.applicant.phone}
      />

      {/* 3. Hiring Progress Tracker */}
      <HiringProgressTracker
        isSaga={isSaga}
        currentStatus={application.status}
        category={application.job.category}
        documentsSatisfied={documentsSatisfied}
        writtenExamPassed={writtenExamPassed}
        teachingDemoSatisfactory={teachingDemoSatisfactory}
        hodInterviewCompleted={hodInterviewCompleted}
        presidentInterviewCompleted={presidentInterviewCompleted}
        hasOffer={application.offers.length > 0}
        offerAccepted={hasAcceptedOffer}
        isOnboarding={Boolean(application.onboarding)}
        onboardingCompleted={application.onboarding?.status === 'COMPLETED'}
        isReadyToHire={readiness.isReadyToHire}
      />

      {/* 4. Tab Navigation (Overview, Documents, Interviews, Assessments, Offers, Onboarding, History) */}
      <ApplicantProfileTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        documentCount={totalDocsCount > 0 ? totalDocsCount : undefined}
        interviewCount={interviewsCount > 0 ? interviewsCount : undefined}
        assessmentCount={assessmentsCount > 0 ? assessmentsCount : undefined}
        offerCount={offersCount > 0 ? offersCount : undefined}
        onboardingTaskCount={onboardingTaskCount > 0 ? onboardingTaskCount : undefined}
      />

      {/* 5. Main 2-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Tab Content (approx 72% on desktop) */}
        <div className="min-w-0 lg:col-span-8 space-y-6">
          {activeTab === 'overview' && (
            <ApplicantOverviewTab
              candidateName={candidateFullName}
              jobTitle={application.job.title}
              department={application.job.department}
              location={application.job.location}
              email={application.applicant.email}
              phone={application.applicant.phone}
              appliedAt={application.appliedAt}
              readiness={readiness}
              structuredReqs={application.job.structuredReqs || []}
              parsedResume={parsedResume}
              resumeDocumentId={resumeDoc?.id}
              canManageResume={permissions.canManageJobs}
              verifiedDocsCount={verifiedDocsCount}
              totalDocsCount={totalDocsCount}
              interviewsCount={interviewsCount}
              assessmentsCount={assessmentsCount}
              passedAssessmentsCount={passedAssessmentsCount}
              recentHistory={recentActivities}
              onSelectTab={handleTabChange}
            />
          )}

          {activeTab === 'documents' && (
            <ApplicantDocumentsTab
              applicationId={application.id}
              category={application.job.category}
              recruitmentDocuments={application.recruitmentDocuments}
              canManage={permissions.canManageOnb}
              organizationSlug={application.job.organization?.slug || ''}
              uploadedResumes={application.documents.map((d) => ({
                id: d.id,
                fileName: d.fileName,
                fileType: d.fileType,
                fileSize: d.fileSize,
              }))}
              coverLetter={application.coverLetter}
            />
          )}

          {activeTab === 'interviews' && (
            <ApplicantInterviewsTab
              applicationId={application.id}
              candidateName={candidateFullName}
              jobTitle={application.job.title}
              interviews={application.interviews}
              canManage={permissions.canManageIv}
            />
          )}

          {activeTab === 'assessments' && (
            <ApplicantAssessmentsTab
              applicationId={application.id}
              candidateName={candidateFullName}
              jobTitle={application.job.title}
              assessments={application.assessments}
              organizationEvaluators={organizationUsers}
              canManage={permissions.canManageAss}
              canRecordResult={permissions.canRecordScore}
            />
          )}

          {activeTab === 'offers' && (
            <ApplicantOffersTab
              applicationId={application.id}
              candidateName={candidateFullName}
              jobTitle={application.job.title}
              offers={application.offers}
              canManage={permissions.canManageOff}
              canApprove={permissions.canApproveOff}
            />
          )}

          {activeTab === 'onboarding' && (
            <ApplicantOnboardingTab
              applicationId={application.id}
              candidateName={candidateFullName}
              offers={application.offers}
              onboarding={application.onboarding}
              canManage={permissions.canManageOnb}
              category={application.job.category}
            />
          )}

          {activeTab === 'history' && (
            <ApplicantHistoryTab
              initialStatus={application.status}
              appliedAt={application.appliedAt}
              history={application.history}
              interviews={application.interviews}
              assessments={application.assessments}
              offers={application.offers}
              onboarding={application.onboarding}
            />
          )}
        </div>

        {/* Right Column: Information Panel (approx 28% on desktop) */}
        <div className="min-w-0 lg:col-span-4 space-y-6">
          <ApplicantRightSidebar
            applicationId={application.id}
            candidateName={candidateFullName}
            jobTitle={application.job.title}
            currentStatus={application.status}
            employmentCategory={application.job.category}
            employeeId={permissions.canViewEmployees ? application.employee?.id : undefined}
            readiness={readiness}
            canManageStatus={permissions.canEditStatus}
            canManageReadiness={permissions.canEditStatus}
            canViewEmployee={permissions.canViewEmployees}
            recentActivities={recentActivities}
            stageName={stageConfig.label}
            stageNumber={2}
            totalStages={application.job.category === 'TEACHING' ? 10 : 9}
            onSelectTab={handleTabChange}
          />
        </div>
      </div>
    </div>
  );
}

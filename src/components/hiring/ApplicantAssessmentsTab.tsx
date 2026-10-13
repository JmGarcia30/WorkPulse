'use client';

import React from 'react';
import { CandidateAssessmentsSection } from './CandidateAssessmentsSection';

type CandidateAssessmentsProps = React.ComponentProps<typeof CandidateAssessmentsSection>;

interface ApplicantAssessmentsTabProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  assessments: CandidateAssessmentsProps['assessments'];
  organizationEvaluators: CandidateAssessmentsProps['organizationEvaluators'];
  canManage: boolean;
  canRecordResult: boolean;
}

export function ApplicantAssessmentsTab({
  applicationId,
  candidateName,
  jobTitle,
  assessments,
  organizationEvaluators,
  canManage,
  canRecordResult,
}: ApplicantAssessmentsTabProps) {
  return (
    <div className="space-y-6">
      <CandidateAssessmentsSection
        applicationId={applicationId}
        candidateName={candidateName}
        jobTitle={jobTitle}
        assessments={assessments}
        organizationEvaluators={organizationEvaluators}
        canManage={canManage}
        canRecordResult={canRecordResult}
      />
    </div>
  );
}

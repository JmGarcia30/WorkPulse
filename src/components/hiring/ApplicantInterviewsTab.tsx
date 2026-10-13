'use client';

import React from 'react';
import { CandidateInterviewsSection } from './CandidateInterviewsSection';

type CandidateInterviewsProps = React.ComponentProps<typeof CandidateInterviewsSection>;

interface ApplicantInterviewsTabProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  interviews: CandidateInterviewsProps['interviews'];
  canManage: boolean;
}

export function ApplicantInterviewsTab({
  applicationId,
  candidateName,
  jobTitle,
  interviews,
  canManage,
}: ApplicantInterviewsTabProps) {
  return (
    <div className="space-y-6">
      <CandidateInterviewsSection
        applicationId={applicationId}
        candidateName={candidateName}
        jobTitle={jobTitle}
        interviews={interviews}
        canManage={canManage}
      />
    </div>
  );
}

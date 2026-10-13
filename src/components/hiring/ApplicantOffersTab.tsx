'use client';

import React from 'react';
import { CandidateOffersSection } from './CandidateOffersSection';

type CandidateOffersProps = React.ComponentProps<typeof CandidateOffersSection>;

interface ApplicantOffersTabProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  offers: CandidateOffersProps['offers'];
  canManage: boolean;
  canApprove: boolean;
}

export function ApplicantOffersTab({
  applicationId,
  candidateName,
  jobTitle,
  offers,
  canManage,
  canApprove,
}: ApplicantOffersTabProps) {
  return (
    <div className="space-y-6">
      <CandidateOffersSection
        applicationId={applicationId}
        candidateName={candidateName}
        jobTitle={jobTitle}
        offers={offers}
        canManage={canManage}
        canApprove={canApprove}
      />
    </div>
  );
}

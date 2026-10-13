'use client';

import React from 'react';
import { CandidateOnboardingSection } from './CandidateOnboardingSection';
import { EmploymentCategory, OfferStatus } from '@prisma/client';

type CandidateOnboardingProps = React.ComponentProps<typeof CandidateOnboardingSection>;

interface ApplicantOnboardingTabProps {
  applicationId: string;
  candidateName: string;
  offers: Array<{ status: OfferStatus; startDate: Date }>;
  onboarding: CandidateOnboardingProps['onboarding'];
  canManage: boolean;
  category: EmploymentCategory | 'TEACHING' | 'NON_TEACHING';
}

export function ApplicantOnboardingTab({
  applicationId,
  candidateName,
  offers,
  onboarding,
  canManage,
  category,
}: ApplicantOnboardingTabProps) {
  return (
    <div className="space-y-6">
      <CandidateOnboardingSection
        applicationId={applicationId}
        candidateName={candidateName}
        offers={offers}
        onboarding={onboarding}
        canManage={canManage}
        category={category}
      />
    </div>
  );
}

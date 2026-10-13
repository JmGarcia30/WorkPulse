'use client';

import React from 'react';
import { ApplicationTimeline, TimelineHistoryItem, TimelineInterviewItem, TimelineAssessmentItem, TimelineOfferItem, TimelineOnboardingItem } from './ApplicationTimeline';
import { ApplicationStatus } from '@prisma/client';

interface ApplicantHistoryTabProps {
  initialStatus: ApplicationStatus;
  appliedAt: Date | string;
  history: TimelineHistoryItem[];
  interviews?: TimelineInterviewItem[];
  assessments?: TimelineAssessmentItem[];
  offers?: TimelineOfferItem[];
  onboarding?: TimelineOnboardingItem | null;
}

export function ApplicantHistoryTab({
  initialStatus,
  appliedAt,
  history,
  interviews,
  assessments,
  offers,
  onboarding,
}: ApplicantHistoryTabProps) {
  return (
    <div className="space-y-6">
      <ApplicationTimeline
        initialStatus={initialStatus}
        appliedAt={appliedAt}
        history={history}
        interviews={interviews}
        assessments={assessments}
        offers={offers}
        onboarding={onboarding}
      />
    </div>
  );
}

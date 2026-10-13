'use client';

import { useState } from 'react';
import { InterviewType, InterviewStatus } from '@prisma/client';
import { InterviewModal } from './InterviewModal';
import { InterviewCard, EvaluationData } from './InterviewCard';
import { Calendar, Plus, Video } from 'lucide-react';

interface InterviewItem {
  id: string;
  applicationId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string | Date;
  durationMinutes: number;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  interviewer: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  evaluation: EvaluationData | null;
}

interface CandidateInterviewsSectionProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  interviews: InterviewItem[];
  canManage: boolean;
}

export function CandidateInterviewsSection({
  applicationId,
  candidateName,
  jobTitle,
  interviews,
  canManage,
}: CandidateInterviewsSectionProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const upcomingInterviews = interviews.filter(
    (i) => i.status === InterviewStatus.SCHEDULED
  );
  const pastInterviews = interviews.filter(
    (i) => i.status !== InterviewStatus.SCHEDULED
  );

  return (
    <div className="space-y-6">
      {/* Header with Schedule Button */}
      <div className="rounded-lg border border-[var(--wp-border)] bg-white p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--wp-border)] pb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--wp-text)] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[var(--wp-text)]" />
              Interview Management & Candidate Evaluation
            </h3>
            <p className="text-sm text-[var(--wp-text-muted)] mt-0.5">
              Coordinate interview rounds, log evaluations, and record hiring recommendations.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-3.5 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition self-start sm:self-auto shrink-0"
            >
              <Plus className="h-4 w-4" /> Schedule Interview
            </button>
          )}
        </div>

        {/* Interviews Listing */}
        {interviews.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-md space-y-2">
            <Video className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              No interviews scheduled yet
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Schedule an initial screening, technical test, or behavioral interview for this candidate.
            </p>
            {canManage && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Schedule First Interview
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upcoming Interviews */}
            {upcomingInterviews.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Upcoming & Active Interviews ({upcomingInterviews.length})
                </h4>
                <div className="space-y-3">
                  {upcomingInterviews.map((iv) => (
                    <InterviewCard
                      key={iv.id}
                      interview={iv}
                      candidateName={candidateName}
                      canManage={canManage}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past / Completed Interviews */}
            {pastInterviews.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Completed & Past Interviews ({pastInterviews.length})
                </h4>
                <div className="space-y-3">
                  {pastInterviews.map((iv) => (
                    <InterviewCard
                      key={iv.id}
                      interview={iv}
                      candidateName={candidateName}
                      canManage={canManage}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <InterviewModal
          applicationId={applicationId}
          candidateName={candidateName}
          jobTitle={jobTitle}
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
        />
      )}
    </div>
  );
}

import { AssessmentStatus, EvaluationRecommendation, InterviewStatus } from '@prisma/client';

export function isInterviewApproved(interview: { status: InterviewStatus; recommendation?: string | null }) {
  return interview.status === InterviewStatus.COMPLETED && (
    interview.recommendation === EvaluationRecommendation.RECOMMEND ||
    interview.recommendation === EvaluationRecommendation.STRONGLY_RECOMMEND
  );
}

export function isAssessmentPassed(assessment: { status: AssessmentStatus; score?: number | null; passingScore?: number | null }) {
  return assessment.status === AssessmentStatus.PASSED && (
    assessment.passingScore == null || (assessment.score != null && assessment.score >= assessment.passingScore)
  );
}

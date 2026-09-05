import {
  ApplicationStatus,
  AssessmentStatus,
  AssessmentType,
  EmploymentCategory,
  EvaluationRecommendation,
  InterviewStatus,
  InterviewType,
  OfferStatus,
  OnboardingStatus,
  OnboardingTaskStatus,
  RecruitmentDocumentStatus,
  RecruitmentDocumentType,
} from '@prisma/client';
import { canCompleteOnboarding } from './onboarding-pipeline';
import { areRecruitmentDocumentsSatisfied } from './saga-requirements';

export interface ReadinessChecklistItem {
  key: string;
  label: string;
  isComplete: boolean;
  statusText: string;
  blockingReason?: string;
  type:
    | 'application'
    | 'document'
    | 'assessment'
    | 'teaching_demo'
    | 'hod_interview'
    | 'president_interview'
    | 'interview'
    | 'offer'
    | 'onboarding';
}

export interface HiringReadinessResult {
  isReadyToHire: boolean;
  overallStatus: 'READY' | 'NOT_READY' | 'HIRED' | 'TERMINAL';
  badgeLabel: string;
  badgeBg: string;
  badgeText: string;
  checklist: ReadinessChecklistItem[];
  unmetRequirements: string[];
  summary: string;
}

export interface ApplicationReadinessSource {
  id?: string;
  status: ApplicationStatus;
  appliedAt?: Date;
  jobCategory?: EmploymentCategory | 'TEACHING' | 'NON_TEACHING';
  applicant?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  recruitmentDocuments?: Array<{
    type: RecruitmentDocumentType;
    status: RecruitmentDocumentStatus;
    isRequired: boolean;
    isConditional: boolean;
    title?: string;
  }>;
  interviews?: Array<{
    id: string;
    type?: InterviewType;
    status: InterviewStatus;
    evaluationNotes?: string | null;
    recommendation?: string | null;
    overallScore?: number | null;
  }>;
  assessments?: Array<{
    id: string;
    title: string;
    type?: AssessmentType;
    status: AssessmentStatus;
    passingScore?: number | null;
    score?: number | null;
  }>;
  offers?: Array<{
    id: string;
    status: OfferStatus;
    startDate: Date;
    salary: number;
    employmentType: string;
    contractSignedByPresident?: boolean;
    contractSignedByEmployee?: boolean;
  }>;
  onboarding?: {
    id: string;
    status: OnboardingStatus;
    tasks?: Array<{
      id: string;
      title: string;
      isRequired: boolean;
      status: OnboardingTaskStatus;
    }>;
  } | null;
}

/**
 * Deterministically evaluate whether a candidate has cleared all prerequisite stages
 * and is officially "READY TO HIRE" before final conversion to an employee record.
 * Strictly implements the SAGA Institutional Hiring Policy for Faculty and Non-Teaching personnel.
 */
export function calculateHiringReadiness(
  application: ApplicationReadinessSource
): HiringReadinessResult {
  // If already hired, return HIRED state
  if (application.status === ApplicationStatus.HIRED) {
    return {
      isReadyToHire: false,
      overallStatus: 'HIRED',
      badgeLabel: 'Already Hired',
      badgeBg: 'bg-teal-50 dark:bg-teal-950/60 ring-1 ring-teal-500/20',
      badgeText: 'text-teal-700 dark:text-teal-300',
      checklist: [],
      unmetRequirements: [],
      summary: 'Candidate has completed all pre-employment requirements and is hired.',
    };
  }

  // Terminal stages
  if (
    application.status === ApplicationStatus.REJECTED ||
    application.status === ApplicationStatus.WITHDRAWN
  ) {
    return {
      isReadyToHire: false,
      overallStatus: 'TERMINAL',
      badgeLabel: application.status === ApplicationStatus.REJECTED ? 'Rejected' : 'Withdrawn',
      badgeBg: 'bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700',
      badgeText: 'text-slate-600 dark:text-slate-400',
      checklist: [],
      unmetRequirements: [`Application is ${application.status.toLowerCase()}.`],
      summary: `Candidate application was marked as ${application.status}.`,
    };
  }

  const checklist: ReadinessChecklistItem[] = [];
  const unmetRequirements: string[] = [];

  const category = application.jobCategory as EmploymentCategory | undefined;
  const isTeaching = category === EmploymentCategory.TEACHING;
  const isSagaMode = Boolean(category);

  // 1. Application Submission Check
  const hasApplicantInfo = application.applicant
    ? Boolean(
        application.applicant.firstName &&
          application.applicant.lastName &&
          application.applicant.email
      )
    : true;
  checklist.push({
    key: 'application',
    label: 'Application Completed',
    isComplete: hasApplicantInfo,
    statusText: hasApplicantInfo
      ? 'Profile and contact details verified'
      : 'Incomplete profile data',
    blockingReason: hasApplicantInfo
      ? undefined
      : 'Candidate contact information is missing.',
    type: 'application',
  });
  if (!hasApplicantInfo) {
    unmetRequirements.push('Candidate contact information is incomplete.');
  }

  // 2. Required Recruitment Documents (SAGA Policy Step 1)
  if (isSagaMode || application.recruitmentDocuments) {
    const docs = application.recruitmentDocuments || [];
    const docEval = areRecruitmentDocumentsSatisfied(
      docs,
      category || EmploymentCategory.NON_TEACHING
    );

    let docStatusText = 'Required recruitment documents verified';
    let docBlockingReason: string | undefined;

    if (!docEval.isSatisfied) {
      docStatusText = `${docEval.missingMandatory.length} required document(s) missing`;
      docBlockingReason = `Missing mandatory recruitment documents: ${docEval.missingMandatory.slice(0, 3).join(', ')}${docEval.missingMandatory.length > 3 ? '...' : ''}.`;
    } else if (docs.length === 0) {
      // In SAGA mode without documents initialized
      docStatusText = 'Recruitment documents checklist not initialized';
      docBlockingReason = 'Mandatory recruitment documents must be submitted to the Head of the Department.';
    } else {
      docStatusText = `All ${docEval.mandatoryCount} mandatory recruitment documents satisfied`;
    }

    const isDocComplete = docEval.isSatisfied && docs.length > 0;
    checklist.push({
      key: 'documents',
      label: 'Recruitment Documents Satisfied',
      isComplete: isDocComplete,
      statusText: docStatusText,
      blockingReason: isDocComplete ? undefined : docBlockingReason,
      type: 'document',
    });
    if (!isDocComplete && docBlockingReason) {
      unmetRequirements.push(docBlockingReason);
    }
  }

  // 3. Written Examination (SAGA Policy Step 2)
  const assessments = application.assessments || [];
  let assessmentComplete = true;
  let assessmentStatusText = 'No assessments assigned or required';
  let assessmentBlockingReason: string | undefined;

  const writtenExam = assessments.find(
    (a) =>
      a.type === AssessmentType.WRITTEN_EXAMINATION ||
      a.title.toLowerCase().includes('written') ||
      a.title.toLowerCase().includes('exam') ||
      a.title.toLowerCase().includes('subject')
  );

  const failedAssessments = assessments.filter(
    (a) => a.status === AssessmentStatus.FAILED
  );
  const pendingAssessments = assessments.filter(
    (a) =>
      a.status === AssessmentStatus.ASSIGNED ||
      a.status === AssessmentStatus.IN_PROGRESS ||
      a.status === AssessmentStatus.SUBMITTED ||
      a.status === AssessmentStatus.UNDER_REVIEW
  );

  if (failedAssessments.length > 0) {
    assessmentComplete = false;
    assessmentStatusText = `${failedAssessments.length} assessment(s) failed`;
    assessmentBlockingReason = `Candidate failed mandatory assessment: ${failedAssessments.map((a) => a.title).join(', ')}.`;
  } else if (pendingAssessments.length > 0) {
    assessmentComplete = false;
    assessmentStatusText = `${pendingAssessments.length} assessment(s) in progress / pending evaluation`;
    assessmentBlockingReason = 'Candidate has assigned assessments awaiting score submission.';
  } else if (writtenExam) {
    if (writtenExam.status === AssessmentStatus.PASSED) {
      assessmentComplete = true;
      assessmentStatusText = `Written Examination passed (${writtenExam.score ?? 'Pass'})`;
    } else {
      assessmentComplete = false;
      assessmentStatusText = `Written Examination status: ${writtenExam.status}`;
      assessmentBlockingReason = 'Candidate must pass the required written examination.';
    }
  } else if (isSagaMode) {
    assessmentComplete = false;
    assessmentStatusText = 'Written Examination not assigned';
    assessmentBlockingReason = 'Candidate must undergo and pass the required written examination.';
  } else if (assessments.length > 0) {
    assessmentStatusText = `${assessments.length} assessment(s) successfully passed`;
  }

  checklist.push({
    key: 'assessment',
    label: isSagaMode ? 'Written Examination Passed' : 'Assessments Cleared',
    isComplete: assessmentComplete,
    statusText: assessmentStatusText,
    blockingReason: assessmentBlockingReason,
    type: 'assessment',
  });
  if (!assessmentComplete && assessmentBlockingReason) {
    unmetRequirements.push(assessmentBlockingReason);
  }

  // 4. Teaching Demonstration (SAGA Policy Step 3 — TEACHING ONLY)
  if (isTeaching) {
    const interviews = application.interviews || [];
    const teachingDemoIv = interviews.find(
      (i) => i.type === InterviewType.TEACHING_DEMONSTRATION
    );
    // Backward compatibility fallback: also check if an assessment specifically represents teaching demo
    const teachingDemoAss = assessments.find((a) =>
      a.title.toLowerCase().includes('teaching demo')
    );

    let demoComplete = false;
    let demoStatusText = 'Teaching demonstration not performed';
    let demoBlockingReason: string | undefined;

    if (teachingDemoIv) {
      if (teachingDemoIv.status === InterviewStatus.COMPLETED) {
        if (
          teachingDemoIv.recommendation === EvaluationRecommendation.DO_NOT_RECOMMEND
        ) {
          demoComplete = false;
          demoStatusText = 'Teaching demonstration unsatisfactory';
          demoBlockingReason = 'Teaching demonstration outcome did not meet satisfactory institutional criteria.';
        } else {
          demoComplete = true;
          demoStatusText = 'Teaching demonstration satisfactory';
        }
      } else {
        demoComplete = false;
        demoStatusText = 'Teaching demonstration scheduled / pending';
        demoBlockingReason = 'Teaching demonstration has not been completed.';
      }
    } else if (teachingDemoAss && teachingDemoAss.status === AssessmentStatus.PASSED) {
      demoComplete = true;
      demoStatusText = 'Teaching demonstration cleared';
    } else {
      demoComplete = false;
      demoStatusText = 'Teaching demonstration required for faculty';
      demoBlockingReason = 'Teaching applicant must perform a satisfactory teaching demonstration.';
    }

    checklist.push({
      key: 'teaching_demo',
      label: 'Teaching Demonstration Satisfactory',
      isComplete: demoComplete,
      statusText: demoStatusText,
      blockingReason: demoBlockingReason,
      type: 'teaching_demo',
    });
    if (!demoComplete && demoBlockingReason) {
      unmetRequirements.push(demoBlockingReason);
    }
  }

  // 5. Head of Department Interview (SAGA Policy Step 4)
  if (isSagaMode) {
    const interviews = application.interviews || [];
    const hodIv = interviews.find(
      (i) => i.type === InterviewType.HEAD_OF_DEPARTMENT
    );
    let hodComplete = false;
    let hodStatusText = 'HOD interview not conducted';
    let hodBlockingReason: string | undefined;

    if (hodIv) {
      if (hodIv.status === InterviewStatus.COMPLETED) {
        if (hodIv.recommendation === EvaluationRecommendation.DO_NOT_RECOMMEND) {
          hodComplete = false;
          hodStatusText = 'Not endorsed by Head of Department';
          hodBlockingReason = 'Head of Department did not endorse applicant for final interview.';
        } else {
          hodComplete = true;
          hodStatusText = 'Completed & endorsed by Head of Department';
        }
      } else {
        hodComplete = false;
        hodStatusText = 'HOD interview scheduled, pending completion';
        hodBlockingReason = 'Head of Department interview has not been completed.';
      }
    } else {
      hodComplete = false;
      hodStatusText = 'HOD interview required';
      hodBlockingReason = 'Applicant must undergo an interview with the Head of the Department.';
    }

    checklist.push({
      key: 'hod_interview',
      label: 'Head of Department Interview Completed',
      isComplete: hodComplete,
      statusText: hodStatusText,
      blockingReason: hodBlockingReason,
      type: 'hod_interview',
    });
    if (!hodComplete && hodBlockingReason) {
      unmetRequirements.push(hodBlockingReason);
    }

    // 6. President Final Interview (SAGA Policy Step 5)
    const presidentIv = interviews.find(
      (i) => i.type === InterviewType.PRESIDENT_FINAL
    );
    let presComplete = false;
    let presStatusText = 'President final interview not conducted';
    let presBlockingReason: string | undefined;

    if (presidentIv) {
      if (presidentIv.status === InterviewStatus.COMPLETED) {
        if (
          presidentIv.recommendation === EvaluationRecommendation.DO_NOT_RECOMMEND
        ) {
          presComplete = false;
          presStatusText = 'President final interview not approved';
          presBlockingReason = 'President final interview did not qualify for contract execution.';
        } else {
          presComplete = true;
          presStatusText = 'President final interview completed & qualified';
        }
      } else {
        presComplete = false;
        presStatusText = 'President final interview scheduled, pending completion';
        presBlockingReason = 'President final interview has not been completed.';
      }
    } else {
      presComplete = false;
      presStatusText = 'President final interview required';
      presBlockingReason = 'Qualified applicant must be endorsed to the President for final interview.';
    }

    checklist.push({
      key: 'president_interview',
      label: 'President Final Interview Completed',
      isComplete: presComplete,
      statusText: presStatusText,
      blockingReason: presBlockingReason,
      type: 'president_interview',
    });
    if (!presComplete && presBlockingReason) {
      unmetRequirements.push(presBlockingReason);
    }
  } else {
    // Non-SAGA legacy mode: Standard unified interview check
    const interviews = application.interviews || [];
    let interviewComplete = true;
    let interviewStatusText = 'No interviews required or scheduled';
    let interviewBlockingReason: string | undefined;

    if (interviews.length > 0) {
      const hasPendingInterview = interviews.some(
        (iv) => iv.status === InterviewStatus.SCHEDULED
      );
      const hasCompletedInterview = interviews.some(
        (iv) => iv.status === InterviewStatus.COMPLETED
      );

      if (hasPendingInterview) {
        interviewComplete = false;
        interviewStatusText = 'Active interview scheduled, pending completion';
        interviewBlockingReason = 'One or more scheduled interviews have not been completed.';
      } else if (!hasCompletedInterview) {
        interviewComplete = false;
        interviewStatusText = 'No completed interviews recorded';
        interviewBlockingReason = 'All interviews were cancelled without completion.';
      } else {
        interviewStatusText = `${interviews.filter((i) => i.status === InterviewStatus.COMPLETED).length} interview(s) completed`;
      }
    }

    checklist.push({
      key: 'interview',
      label: 'Interview & Evaluation Completed',
      isComplete: interviewComplete,
      statusText: interviewStatusText,
      blockingReason: interviewBlockingReason,
      type: 'interview',
    });
    if (!interviewComplete && interviewBlockingReason) {
      unmetRequirements.push(interviewBlockingReason);
    }
  }

  // 7. Employment Contract (SAGA Policy Step 6)
  const offers = application.offers || [];
  const acceptedOffer = offers.find((o) => o.status === OfferStatus.ACCEPTED);
  const activeRejectedOffers = offers.filter(
    (o) => o.status === OfferStatus.REJECTED
  );
  let offerComplete = Boolean(acceptedOffer);
  let offerStatusText = 'No formal offer / contract issued';
  let offerBlockingReason: string | undefined;

  if (acceptedOffer) {
    offerStatusText = `Employment Contract accepted (${acceptedOffer.employmentType}, starting ${new Date(acceptedOffer.startDate).toLocaleDateString()})`;
  } else if (
    activeRejectedOffers.length > 0 &&
    offers.length === activeRejectedOffers.length
  ) {
    offerComplete = false;
    offerStatusText = 'Offer rejected by candidate';
    offerBlockingReason =
      'The issued employment offer was rejected. A revised offer must be issued and accepted.';
  } else if (
    offers.some(
      (o) =>
        o.status === OfferStatus.PENDING_APPROVAL || o.status === OfferStatus.SENT
    )
  ) {
    offerComplete = false;
    offerStatusText = 'Offer pending approval or candidate signature';
    offerBlockingReason =
      'Employment offer is issued but has not yet been accepted by candidate.';
  } else {
    offerComplete = false;
    offerStatusText = 'Awaiting formal contract creation & acceptance';
    offerBlockingReason =
      'A formal employment offer must be created, approved, and marked as Accepted.';
  }

  checklist.push({
    key: 'offer',
    label: 'Employment Contract Accepted',
    isComplete: offerComplete,
    statusText: offerStatusText,
    blockingReason: offerBlockingReason,
    type: 'offer',
  });
  if (!offerComplete && offerBlockingReason) {
    unmetRequirements.push(offerBlockingReason);
  }

  // 8. Orientation on Policies, Rules & Regulations (SAGA Policy Step 7)
  const onboarding = application.onboarding;
  let onboardingComplete = false;
  let onboardingStatusText = 'Onboarding checklist not initialized';
  let onboardingBlockingReason: string | undefined;

  if (!onboarding) {
    onboardingComplete = false;
    onboardingStatusText = 'Pre-employment onboarding not initialized';
    onboardingBlockingReason =
      'Pre-employment onboarding checklist must be initialized and verified.';
  } else {
    const tasks = onboarding.tasks || [];
    const isCompletedProcess = onboarding.status === OnboardingStatus.COMPLETED;
    const allRequiredVerifiedOrWaived =
      tasks.length > 0 && canCompleteOnboarding(tasks);

    if (isCompletedProcess || allRequiredVerifiedOrWaived) {
      onboardingComplete = true;
      const totalRequired = tasks.filter((t) => t.isRequired).length;
      onboardingStatusText = `All ${totalRequired} mandatory orientation & onboarding items verified`;
    } else {
      onboardingComplete = false;
      const pendingRequired = tasks.filter(
        (t) =>
          t.isRequired &&
          t.status !== OnboardingTaskStatus.VERIFIED &&
          t.status !== OnboardingTaskStatus.WAIVED
      );
      onboardingStatusText = `${pendingRequired.length} required onboarding task(s) pending`;
      onboardingBlockingReason = `${pendingRequired.length} mandatory onboarding requirement(s) remain unverified: ${pendingRequired.map((t) => t.title).slice(0, 3).join(', ')}${pendingRequired.length > 3 ? '...' : ''}.`;
    }
  }

  checklist.push({
    key: 'onboarding',
    label: 'Orientation & Pre-Employment Onboarding Completed',
    isComplete: onboardingComplete,
    statusText: onboardingStatusText,
    blockingReason: onboardingBlockingReason,
    type: 'onboarding',
  });
  if (!onboardingComplete && onboardingBlockingReason) {
    unmetRequirements.push(onboardingBlockingReason);
  }

  // All checklist items must be complete for READY TO HIRE
  const isReadyToHire = checklist.every((item) => item.isComplete);

  if (isReadyToHire) {
    return {
      isReadyToHire: true,
      overallStatus: 'READY',
      badgeLabel: 'READY TO HIRE',
      badgeBg:
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30 shadow-xs',
      badgeText: 'text-emerald-700 dark:text-emerald-300 font-extrabold',
      checklist,
      unmetRequirements: [],
      summary:
        'All institutional hiring prerequisites, examinations, interviews, contract terms, and orientation verifications are complete. Ready for official hire conversion.',
    };
  }

  return {
    isReadyToHire: false,
    overallStatus: 'NOT_READY',
    badgeLabel: 'NOT READY TO HIRE',
    badgeBg:
      'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30 shadow-xs',
    badgeText: 'text-amber-700 dark:text-amber-300 font-extrabold',
    checklist,
    unmetRequirements,
    summary: `${unmetRequirements.length} mandatory prerequisite(s) remain pending before this candidate can be hired.`,
  };
}

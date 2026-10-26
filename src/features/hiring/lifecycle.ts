import { ApplicationStatus, EmploymentCategory } from '@prisma/client';

export interface HiringLifecycleState {
  isSaga: boolean;
  currentStatus: ApplicationStatus;
  category?: EmploymentCategory | 'TEACHING' | 'NON_TEACHING';
  documentsSatisfied?: boolean;
  writtenExamPassed?: boolean;
  teachingDemoSatisfactory?: boolean;
  hodInterviewCompleted?: boolean;
  presidentInterviewCompleted?: boolean;
  hasOffer?: boolean;
  offerAccepted?: boolean;
  isOnboarding?: boolean;
  onboardingCompleted?: boolean;
  isReadyToHire?: boolean;
}

interface StepDef {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
}

const TEACHING_STEPS: StepDef[] = [
  { key: 'APPLIED', label: 'Application', shortLabel: 'Applied', description: 'Application submitted' },
  { key: 'DOCUMENTS', label: 'Required Documents', shortLabel: 'Documents', description: 'Mandatory credentials verification' },
  { key: 'WRITTEN_EXAM', label: 'Written Examination', shortLabel: 'Exam', description: 'Subject & pedagogy exam' },
  { key: 'TEACHING_DEMO', label: 'Teaching Demonstration', shortLabel: 'Demo', description: 'Classroom teaching demonstration' },
  { key: 'HOD_INTERVIEW', label: 'HOD Interview', shortLabel: 'HOD', description: 'Department Head interview' },
  { key: 'PRESIDENT_INTERVIEW', label: 'President Interview', shortLabel: 'President', description: 'Final institutional endorsement interview' },
  { key: 'CONTRACT', label: 'Employment Contract', shortLabel: 'Contract', description: 'Probationary contract execution' },
  { key: 'ORIENTATION', label: 'Orientation', shortLabel: 'Orientation', description: 'School policies and regulations orientation' },
  { key: 'READY_TO_HIRE', label: 'Ready to Hire', shortLabel: 'Ready', description: 'All institutional hiring prerequisites verified' },
  { key: 'HIRED', label: 'Hired', shortLabel: 'Hired', description: 'Official employee conversion complete' },
];

const NON_TEACHING_STEPS: StepDef[] = [
  { key: 'APPLIED', label: 'Application', shortLabel: 'Applied', description: 'Application submitted' },
  { key: 'DOCUMENTS', label: 'Required Documents', shortLabel: 'Documents', description: 'Mandatory credentials verification' },
  { key: 'WRITTEN_EXAM', label: 'Written Examination', shortLabel: 'Exam', description: 'Institutional written examination' },
  { key: 'HOD_INTERVIEW', label: 'HOD Interview', shortLabel: 'HOD', description: 'Department Head interview' },
  { key: 'PRESIDENT_INTERVIEW', label: 'President Interview', shortLabel: 'President', description: 'Final institutional interview' },
  { key: 'CONTRACT', label: 'Employment Contract', shortLabel: 'Contract', description: 'Probationary contract execution' },
  { key: 'ORIENTATION', label: 'Orientation', shortLabel: 'Orientation', description: 'School policies orientation' },
  { key: 'READY_TO_HIRE', label: 'Ready to Hire', shortLabel: 'Ready', description: 'All hiring prerequisites verified' },
  { key: 'HIRED', label: 'Hired', shortLabel: 'Hired', description: 'Official employee conversion complete' },
];

export function getHiringLifecycle({
  isSaga,
  currentStatus,
  category,
  documentsSatisfied = false,
  writtenExamPassed = false,
  teachingDemoSatisfactory = false,
  hodInterviewCompleted = false,
  presidentInterviewCompleted = false,
  hasOffer = false,
  offerAccepted = false,
  isOnboarding = false,
  onboardingCompleted = false,
  isReadyToHire = false,
}: HiringLifecycleState) {
  const isTeaching = category === 'TEACHING';
  const steps = isSaga ? (isTeaching ? TEACHING_STEPS : NON_TEACHING_STEPS) : [
    TEACHING_STEPS[0], TEACHING_STEPS[1],
    { key: 'WRITTEN_EXAM', label: 'Assessments & Interviews', shortLabel: 'Review', description: 'Assigned assessments and interviews' },
    { ...TEACHING_STEPS[6], description: 'Offer acceptance' },
    { ...TEACHING_STEPS[7], description: 'Organization onboarding' },
    { ...TEACHING_STEPS[8], description: 'Hiring prerequisites cleared' }, TEACHING_STEPS[9],
  ];

  // Calculate active stage index dynamically from verified workflow state
  let activeIndex = 0;

  if (currentStatus === ApplicationStatus.HIRED) {
    activeIndex = steps.length - 1;
  } else if (isReadyToHire && currentStatus !== ApplicationStatus.REJECTED && currentStatus !== ApplicationStatus.WITHDRAWN) {
    activeIndex = steps.length - 2; // READY_TO_HIRE
  } else if (isOnboarding || onboardingCompleted) {
    activeIndex = steps.findIndex((s) => s.key === 'ORIENTATION');
  } else if (hasOffer || offerAccepted || currentStatus === ApplicationStatus.OFFER) {
    activeIndex = steps.findIndex((s) => s.key === 'CONTRACT');
  } else if (presidentInterviewCompleted) {
    activeIndex = steps.findIndex((s) => s.key === 'CONTRACT');
  } else if (hodInterviewCompleted) {
    activeIndex = steps.findIndex((s) => s.key === 'PRESIDENT_INTERVIEW');
  } else if (isTeaching && teachingDemoSatisfactory) {
    activeIndex = steps.findIndex((s) => s.key === 'HOD_INTERVIEW');
  } else if (writtenExamPassed) {
    activeIndex = steps.findIndex(
      (s) => s.key === (!isSaga ? 'CONTRACT' : isTeaching ? 'TEACHING_DEMO' : 'HOD_INTERVIEW')
    );
  } else if (documentsSatisfied) {
    activeIndex = steps.findIndex((s) => s.key === 'WRITTEN_EXAM');
  } else if (currentStatus === ApplicationStatus.ASSESSMENT || (!isSaga && currentStatus === ApplicationStatus.INTERVIEW)) {
    activeIndex = steps.findIndex((s) => s.key === 'WRITTEN_EXAM');
  } else if (
    currentStatus !== ApplicationStatus.APPLIED &&
    currentStatus !== ApplicationStatus.REJECTED &&
    currentStatus !== ApplicationStatus.WITHDRAWN
  ) {
    activeIndex = steps.findIndex((s) => s.key === 'DOCUMENTS');
  } else {
    activeIndex = 0;
  }

  if (activeIndex === -1) activeIndex = 0;

  const isTerminal =
    currentStatus === ApplicationStatus.REJECTED ||
    currentStatus === ApplicationStatus.WITHDRAWN;

  const currentStep = steps[activeIndex];
  const currentStageLabel = isTerminal
    ? currentStatus === ApplicationStatus.REJECTED ? 'Rejected' : 'Withdrawn'
    : isReadyToHire
    ? 'Ready to Hire'
    : currentStep?.shortLabel || currentStatus;

  return { steps, activeIndex, isTerminal, currentStageLabel };
}

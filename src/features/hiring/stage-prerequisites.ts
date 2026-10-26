import { ApplicationStatus, InterviewStatus, InterviewType } from '@prisma/client';
import { isValidStatusTransition } from './pipeline';
import { calculateHiringPrerequisites, type ApplicationReadinessSource } from './readiness';
import { isInterviewApproved } from './qualification';

/** Generic board labels group SAGA's exam -> demo -> HOD -> President steps
 * inside ASSESSMENT. Requiring those interviews before entry would invert policy. */
export function getStageTransitionBlockers(application: ApplicationReadinessSource, target: ApplicationStatus): string[] {
  if (!isValidStatusTransition(application.status, target)) {
    return [`Invalid status transition from ${application.status} to ${target}.`];
  }
  if (application.employee) return ['An employee record already exists for this application. HR must review the status/history mismatch before any stage change.'];
  if (target === ApplicationStatus.REJECTED || target === ApplicationStatus.WITHDRAWN) return [];
  const readiness = calculateHiringPrerequisites(application);
  if (target === ApplicationStatus.HIRED) return readiness.unmetRequirements;
  const keys = new Set<string>();
  if (target !== ApplicationStatus.SCREENING) keys.add('documents');
  if (target === ApplicationStatus.OFFER) {
    ['assessment', 'teaching_demo', 'hod_interview', 'president_interview', 'interview'].forEach(key => keys.add(key));
  }
  const blockers = readiness.checklist.filter(item => keys.has(item.key) && !item.isComplete)
    .map(item => item.blockingReason || item.statusText);
  if (target === ApplicationStatus.ASSESSMENT || target === ApplicationStatus.OFFER) {
    const institutional = new Set<InterviewType>([InterviewType.TEACHING_DEMONSTRATION, InterviewType.HEAD_OF_DEPARTMENT, InterviewType.PRESIDENT_FINAL]);
    for (const interview of application.interviews || []) {
      if (target === ApplicationStatus.ASSESSMENT && application.hiringPolicy?.isSaga && interview.type && institutional.has(interview.type)) continue;
      if (interview.status !== InterviewStatus.CANCELLED && !isInterviewApproved(interview)) {
        blockers.push(`${interview.type || 'Assigned'} interview must be completed with a positive evaluation before advancement.`);
      }
    }
  }
  return [...new Set(blockers)];
}

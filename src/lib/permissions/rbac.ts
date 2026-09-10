import { Role } from '@prisma/client';
import { UserSessionPayload } from '@/lib/auth/session';

export function canManageJobs(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canUpdateApplicationStatus(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canViewHiringData(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return (
    user.role === Role.ORGANIZATION_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.HIRING_MANAGER
  );
}

export function canManageInterviews(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return (
    user.role === Role.ORGANIZATION_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.HIRING_MANAGER
  );
}

export function canEvaluateCandidate(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return (
    user.role === Role.ORGANIZATION_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.HIRING_MANAGER
  );
}

export function canManageAssessments(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return (
    user.role === Role.ORGANIZATION_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.HIRING_MANAGER
  );
}

export function canRecordAssessmentResult(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return (
    user.role === Role.ORGANIZATION_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.HIRING_MANAGER
  );
}

export function canManageOffers(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canApproveOffer(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canManageOnboarding(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canManageRecruitmentDocuments(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return (
    user.role === Role.ORGANIZATION_ADMIN ||
    user.role === Role.HR_ADMIN ||
    user.role === Role.HIRING_MANAGER
  );
}

export function canVerifyOnboardingTasks(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canViewEmployees(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canManageEmployees(user: UserSessionPayload | null): boolean {
  return canViewEmployees(user);
}

export function canManageEmploymentLifecycle(
  user: UserSessionPayload | null
): boolean {
  if (!user) return false;
  return user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
}

export function canViewAttendance(user: UserSessionPayload | null): boolean {
  return canViewEmployees(user);
}

export function canManageSchedules(user: UserSessionPayload | null): boolean {
  return canViewAttendance(user);
}

export function canRecordAttendance(user: UserSessionPayload | null): boolean {
  return canViewAttendance(user);
}

export function canCorrectAttendance(user: UserSessionPayload | null): boolean {
  return canViewAttendance(user);
}

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



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

export function canAccessEmployeeSelfService(user: UserSessionPayload | null): boolean {
  return user?.role === Role.EMPLOYEE;
}

export function canViewOwnProfile(user: UserSessionPayload | null): boolean {
  return canAccessEmployeeSelfService(user);
}

export function canViewOwnAttendance(user: UserSessionPayload | null): boolean {
  return canAccessEmployeeSelfService(user);
}

export function canAccessBackOffice(user: UserSessionPayload | null): boolean {
  if (!user) return false;
  const roles: Role[] = [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN, Role.HIRING_MANAGER];
  return roles.includes(user.role);
}

export const canViewOrganizationLeave = canViewEmployees;
export const canManageLeaveTypes = canManageEmployees;
export const canManageLeaveBalances = canManageEmployees;
export const canGrantCycleEntitlements = canManageEmployees;
export const canReviewLeaveRequests = canManageEmployees;
export const canCancelApprovedLeave = canManageEmployees;
export const canRetryLeaveAttendanceSync = canManageEmployees;
export const canViewOwnLeave = canAccessEmployeeSelfService;
export const canSubmitOwnLeave = canAccessEmployeeSelfService;
export const canWithdrawOwnLeave = canAccessEmployeeSelfService;

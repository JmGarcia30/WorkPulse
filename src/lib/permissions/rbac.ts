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

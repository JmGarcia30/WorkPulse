import { Role } from '@prisma/client';
import { isSelfServiceOnlyRole } from './access-roles';

export function landingPathForRole(role: Role) {
  return isSelfServiceOnlyRole(role) ? '/employee' : '/dashboard';
}

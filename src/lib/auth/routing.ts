import { Role } from '@prisma/client';

export function landingPathForRole(role: Role) {
  return role === Role.EMPLOYEE ? '/employee' : '/dashboard';
}

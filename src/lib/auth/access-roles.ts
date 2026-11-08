import { Role } from '@prisma/client';

// ESS is always resolved through the active account/employee ownership checks.
// These roles confer no Finance or Executive workspace permissions.
export const employeeAccessRoles: Role[] = [Role.EMPLOYEE, Role.HR_ADMIN, Role.FINANCE_OFFICER, Role.ORGANIZATION_HEAD];
export function hasEmployeeSelfRole(role: Role) { return employeeAccessRoles.includes(role); }
export function isSelfServiceOnlyRole(role: Role) {
  return role === Role.EMPLOYEE || role === Role.FINANCE_OFFICER || role === Role.ORGANIZATION_HEAD;
}
export const accessRoleLabels = {
  EMPLOYEE: 'Employee', HR_ADMIN: 'HR Administrator', FINANCE_OFFICER: 'Finance Officer', ORGANIZATION_HEAD: 'Organization Head',
} as const;

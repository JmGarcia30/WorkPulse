import assert from 'node:assert/strict';
import { employeeRegistrationSchema } from '../src/features/employees/registration-schema';

const base = {
  registrationKey: '4f2a7b31-71cf-4dd0-b107-88c71effb814',
  firstName: 'Alex', lastName: 'Rivera', employeeNumber: 'EMP-TEST-0001',
  email: 'alex@example.com', phone: '09123456789', department: 'Human Resources',
  jobTitle: 'HR Staff', startDate: '2026-01-01', employeeStatus: 'ACTIVE',
  employmentStatus: 'REGULAR', employmentCategory: 'NON_TEACHING',
  employmentType: 'Full-time', salary: '25000.00', payFrequency: 'MONTHLY',
  registrationReason: 'Verified historical employment records', sendInvitation: true,
  probationStandardsConfirmed: false,
};

function parse(data: Record<string, unknown>) {
  return employeeRegistrationSchema.safeParse(data);
}
function errorPath(data: Record<string, unknown>, path: string) {
  const parsed = parse(data);
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.ok(parsed.error.issues.some(issue => issue.path.includes(path)), `Expected validation on ${path}`);
}

assert.equal(parse({ ...base, role: 'EMPLOYEE' }).success, true, 'Employee ESS-only registration should succeed.');
errorPath({ ...base, role: 'HR_ADMIN' }, 'managementRoleConfirmed');
assert.equal(parse({ ...base, role: 'HR_ADMIN', managementRoleConfirmed: true }).success, true);
errorPath({ ...base, role: 'EMPLOYEE', existingUserId: 'existing-user-1' }, 'existingAccountLinkConfirmed');
assert.equal(parse({ ...base, role: 'HR_ADMIN', managementRoleConfirmed: true, existingUserId: 'existing-user-1', existingAccountLinkConfirmed: true }).success, true);
errorPath({ ...base, role: 'HR_ADMIN', existingUserId: 'existing-user-1', existingAccountLinkConfirmed: true }, 'managementRoleConfirmed');
console.log('PASS: HR role assignment and existing-login linking require explicit independent confirmations.');

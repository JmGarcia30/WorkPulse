import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { canReturnFromEssToHr } from '../src/lib/auth/access-roles';
import { canAccessBackOffice } from '../src/lib/permissions/rbac';

for (const role of Object.values(Role)) {
  const shouldShow = role === Role.HR_ADMIN;
  assert.equal(canReturnFromEssToHr(role), shouldShow, `Unexpected ESS return navigation for ${role}`);
  if (shouldShow) {
    assert.equal(canAccessBackOffice({ userId: 'test', organizationId: 'tenant-a', email: 'test@example.com', name: 'Test', role }), true);
  }
}
for (const role of [Role.EMPLOYEE, Role.FINANCE_OFFICER, Role.ORGANIZATION_HEAD]) {
  assert.equal(canAccessBackOffice({ userId: 'test', organizationId: 'tenant-a', email: 'test@example.com', name: 'Test', role }), false);
}
console.log('PASS: ESS return navigation is limited to HR_ADMIN; ESS-only roles cannot access back office.');

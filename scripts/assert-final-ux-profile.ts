import assert from 'node:assert/strict';
import { getOrganizationEmployeeById, type EmployeeProfileReadTab } from '../src/features/employees/queries';
import { getOrganizationEmployeeById as legacyProfile } from './reference/final-ux-employees';

export async function assertProfileTabParity(organizationId: string, employeeId: string) {
  const original = await legacyProfile(organizationId, employeeId);
  assert.ok(original);
  const counts = { employmentDecisions: original.employmentDecisions.length, statusHistory: original.statusHistory.length };
  const complete = await getOrganizationEmployeeById(organizationId, employeeId);
  assert.deepStrictEqual(complete, { ...original, _count: counts });
  for (const tab of ['overview', 'probation', 'history', 'decisions', 'compliance', 'account'] as EmployeeProfileReadTab[]) {
    const result = await getOrganizationEmployeeById(organizationId, employeeId, tab);
    const expected: unknown = {
      ...original,
      _count: counts,
      employmentRecords: original.employmentRecords.map(record => {
        if (tab === 'compliance') return record;
        const { acceptedOffer, ...rest } = record;
        void acceptedOffer;
        return rest;
      }),
      probationRecords: tab === 'probation' ? original.probationRecords : [],
      employmentDecisions: tab === 'decisions' ? original.employmentDecisions : [],
      statusHistory: tab === 'decisions' ? original.statusHistory : [],
      employeeAccount: tab === 'account' ? original.employeeAccount : null,
    };
    assert.deepStrictEqual(result, expected, `Exact profile data and badges for ${tab}`);
    assert.equal(await getOrganizationEmployeeById('wrong-tenant', employeeId, tab), null);
  }
  console.log('UX Profile: full-read and all six tab payloads match the frozen oracle; tenant isolation passes.');
}

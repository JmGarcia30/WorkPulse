/** Display only: read recorded amounts, never calculate a contribution or fill missing values with zero. */
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
const recorded = (value: unknown): string | null => typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value) ? value : null;

export function payrollSnapshotBreakdown(value: unknown) {
  const snapshot = object(value), statutory = object(snapshot.statutory);
  const integrated = snapshot.version === 'WORKPULSE-PAYROLL-2B-1' && statutory.version === 'WORKPULSE-PAYROLL-2B-1';
  const shares = integrated ? object(statutory.employeeStatutoryDeductions) : {};
  const bir = integrated ? object(statutory.bir) : {};
  const company = object(object(snapshot.policy).deductionRules);
  const employer = integrated ? object(statutory.employerContributions) : {};
  const agencies = ['SSS', 'PHILHEALTH', 'PAGIBIG'] as const;
  const employee = {
    sss: recorded(shares.SSS), philHealth: recorded(shares.PHILHEALTH), pagIbig: recorded(shares.PAGIBIG),
    bir: integrated ? recorded(statutory.birWithholding) : null,
    late: recorded(object(company.late).amount), absence: recorded(object(company.absence).amount), undertime: recorded(object(company.undertime).amount),
    unionDues: recorded(bir.unionDues),
    // The BIR other-net total includes net-only company deductions. Show the original separate lines to avoid double counting.
    otherNetDeductions: integrated && Array.isArray(object(bir.inputs).otherNetDeductions)
      ? (object(bir.inputs).otherNetDeductions as unknown[]).filter(item => object(item).id !== 'COMPANY_POLICY_NET').map(item => ({ id: String(object(item).id ?? ''), amount: recorded(object(item).amount) })) : [],
  };
  return {
    format: integrated ? 'INTEGRATED' as const : snapshot.version === 'WORKPULSE-PAYROLL-2B-1' ? 'UNAVAILABLE' as const : 'LEGACY' as const,
    employee,
    taxableCompensation: integrated ? recorded(statutory.taxableCompensation) : null,
    employer: agencies.map(agency => ({ agency, counterpart: recorded(object(employer[agency]).counterpart), employerOnly: recorded(object(employer[agency]).employerOnly) })),
    allocation: integrated && ['MONTHLY', 'SEMI_MONTHLY'].includes(String(statutory.frequency)) && ['MONTH', 'FIRST', 'SECOND'].includes(String(statutory.slot)) && /^\d{4}-\d{2}$/.test(String(statutory.contributionMonth))
      ? { frequency: String(statutory.frequency), slot: String(statutory.slot), month: String(statutory.contributionMonth) } : null,
  };
}
export type PayrollSnapshotBreakdown = ReturnType<typeof payrollSnapshotBreakdown>;

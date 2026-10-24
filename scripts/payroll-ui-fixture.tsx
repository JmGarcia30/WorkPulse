import { createRoot } from 'react-dom/client';
import { PayslipView } from '../src/components/payroll/PayslipView';
import { PayrollStatutorySetupPanel } from '../src/components/payroll/PayrollStatutorySetupPanel';
import { PayrollProcessingTab } from '../src/components/payroll/PayrollProcessingTab';
import { EmployeePayrollEntriesTable } from '../src/components/payroll/EmployeePayrollEntriesTable';
import type { PayslipViewModel } from '../src/features/payroll/payslip';
import type { PayrollStatutorySetupRow } from '../src/features/payroll/setup-queries';
import type { OrganizationBrandingView } from '../src/features/organization-branding/read-model';
import type { PayrollDashboardEntryItem } from '../src/features/payroll/queries';

interface Fixtures { monthly: PayslipViewModel; first: PayslipViewModel; second: PayslipViewModel; legacy: PayslipViewModel; setupRows: PayrollStatutorySetupRow[]; lockedRows: PayrollStatutorySetupRow[]; branding: OrganizationBrandingView }
const money = (value: string) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value));
function App({ fixtures }: { fixtures: Fixtures }) {
  const mode = new URLSearchParams(location.search).get('mode') ?? 'monthly';
  if (mode === 'setup' || mode === 'locked') return <PayrollStatutorySetupPanel rows={mode === 'setup' ? fixtures.setupRows : fixtures.lockedRows} periodId="fixture-period" periodName="September 2026" payDate="2026-09-30" />;
  if (mode.startsWith('processing')) {
    const period = { id: 'fixture-period', name: 'September 2026', periodStart: new Date('2026-09-01Z'), periodEnd: new Date('2026-09-30Z'), payDate: new Date('2026-09-30Z'), status: 'REVIEW' };
    const entries: PayrollDashboardEntryItem[] = [fixtures.monthly, fixtures.first, fixtures.second].map((item, index) => ({
      id: item.entryId, employeeId: `employee-${index}`, employeeNumber: item.employee.employeeNumber, firstName: 'Payroll', lastName: item.breakdown.allocation?.slot ?? '',
      compensationType: 'MONTHLY', baseRateFormatted: money(item.payroll.compensationRate), payFrequency: item.payroll.payFrequency, currency: 'PHP', periodName: period.name,
      baseAmountFormatted: money(item.calculation.basePay), grossAmountFormatted: money(item.calculation.grossPay), totalDeductionsFormatted: money(item.calculation.totalDeductions), netAmountFormatted: money(item.calculation.netPay),
      grossNumeric: Number(item.calculation.grossPay), deductionsNumeric: Number(item.calculation.totalDeductions), netNumeric: Number(item.calculation.netPay), status: 'REVIEW', reviewState: 'READY', issueMessage: null, attendanceSummary: null, leaveSummary: null, canViewPayslip: false, breakdown: item.breakdown,
    }));
    const ready = mode === 'processing-ready';
    return <><PayrollProcessingTab periods={[period]} selectedPeriod={period} review={{ period, summary: { totalEmployees: 1, ready: ready ? 1 : 0, setupRequired: ready ? 0 : 1, errors: 0 }, totals: { employeeCount: 1, gross: '35000', deductions: '4526.30', net: '30473.70' }, issues: ready ? [] : [{ employeeId: 'employee-0', kind: 'SETUP_REQUIRED', message: 'Verify complete opening benefit history before generation.' }], canFinalize: ready }} /><EmployeePayrollEntriesTable entries={entries} selectedPeriodName={period.name} isPeriodFinalized={false} /></>;
  }
  const key = ['monthly', 'first', 'second', 'legacy'].includes(mode) ? mode as 'monthly' | 'first' | 'second' | 'legacy' : 'monthly';
  return <PayslipView payslip={fixtures[key]} branding={fixtures.branding} backHref="/employee/payroll" />;
}
fetch('/fixtures.json').then(response => response.json()).then((fixtures: Fixtures) => createRoot(document.getElementById('root')!).render(<App fixtures={fixtures} />));

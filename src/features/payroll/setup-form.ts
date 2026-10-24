import { PayrollError } from './domain';
import { openingSchema, parseStatutoryInput } from './statutory-inputs';

const field = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
function confirmed(form: FormData, name: string, message: string) {
  if (form.get(name) !== 'CONFIRMED') throw new PayrollError('SETUP_REQUIRED', message);
}
function rows(form: FormData, name: string): unknown[] {
  const raw = field(form, name);
  try {
    if (!raw || raw.length > 64_000) throw Error();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 100) throw Error();
    return parsed;
  } catch { throw new PayrollError('SETUP_REQUIRED', `Review the ${name === 'additionalEarnings' ? 'additional earnings' : 'other net deductions'} rows and submit again.`); }
}

export function statutoryPayloadFromForm(form: FormData, reviewerId: string) {
  confirmed(form, 'profileReviewed', 'Confirm the supported employee tax profile and exceptional-method checks.');
  confirmed(form, 'historyReviewed', 'Confirm that no contributions for this month are missing from the allocation ledger.');
  confirmed(form, 'earningsReviewed', 'Confirm complete cash earnings and the reviewed monthly agency bases.');
  const coverage = Object.fromEntries(['SSS', 'PHILHEALTH', 'PAGIBIG'].map(agency => {
    const status = field(form, `coverage.${agency}`);
    return [agency, status === 'EXEMPT' ? { status, legalBasis: field(form, `legalBasis.${agency}`), evidenceReference: field(form, `evidence.${agency}`), reviewedBy: reviewerId } : { status }];
  }));
  return parseStatutoryInput({
    arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH', earningsComplete: true,
    monthlySssRemuneration: field(form, 'monthlySssRemuneration'), monthlyPhilHealthBasic: field(form, 'monthlyPhilHealthBasic'), monthlyPagIbigFundSalary: field(form, 'monthlyPagIbigFundSalary'),
    agencyBasisReference: field(form, 'agencyBasisReference'), contributionHistory: 'NO_UNTRACKED_CONTRIBUTIONS_FOR_MONTH', coverage,
    profile: { residency: 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN', employment: 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER', minimumWageStatus: 'NOT_MWE', previousEmployerInTaxYear: false, cumulativeMethodAlreadyRequired: false, annualizationRequired: false, finalPayment: false },
    additionalEarnings: rows(form, 'additionalEarnings'), otherNetDeductions: rows(form, 'otherNetDeductions'),
    companyDeductionTreatment: Object.fromEntries(['late', 'absence', 'undertime'].map(key => [key, field(form, `treatment.${key}`)])),
    unionDues: { amount: field(form, 'unionDues'), reference: field(form, 'unionReference') },
  });
}

export function openingBalancesFromForm(form: FormData) {
  confirmed(form, 'openingReviewed', 'Confirm that the complete history before the opening payment date has been reviewed, including explicit zero balances.');
  const result = openingSchema.safeParse(Object.fromEntries(Object.keys(openingSchema.shape).map(key => [key, field(form, key)])));
  if (!result.success) throw new PayrollError('SETUP_REQUIRED', 'Enter every opening balance as a nonnegative peso amount with at most two decimal places. Enter 0 only when verified.');
  return result.data;
}

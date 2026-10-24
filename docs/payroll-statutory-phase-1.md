# Payroll Phase 1: Philippine statutory engine

Verified on **2026-10-22**. Implemented as pure functions in `src/features/payroll/statutory/`, with no database client, writes, migration, live generation hook, or changes to existing policies/snapshots. Existing Hiring, Leave and Probation work is preserved.

## Official sources and supported dates

| Agency | Effective contribution month | Basis and ceiling | Employee | Employer | Employer-only |
| --- | --- | --- | --- | --- | --- |
| SSS business employees | January 2025 onward | Total actual monthly remuneration (including COLA and cash value of noncash pay), mapped to the published MSC bracket; MSC floor 5,000, ceiling 35,000 | 5% of MSC | 10% of MSC | EC: 10 for MSC <=14,500; 30 for MSC >=15,000 |
| PhilHealth | January 2025 schedule; continued for 2026 | Fixed monthly basic salary before attendance deductions; assessment floor 10,000 and ceiling 100,000 | Half of 5% premium, subject to odd-cent rule | Remaining half | None |
| Pag-IBIG | February 2024 onward | Monthly Fund Salary: basic salary and other allowances, with the broad remuneration definition in Circular 460; capped at 10,000 | 1% at <=1,500; 2% above 1,500 | 2% | None for the supported arrangement |

Amounts are PHP. These are monthly liabilities, regardless of payout frequency. SSS regular SS covers MSC up to 20,000; contributions on the excess are separately reported as mandatory provident fund (MPF/MySSS Pension Booster). Employer counterpart excludes EC in engine results; `employerTotal` includes EC.

Primary documents read:

- **SSS Circular 2024-006**, signed December 19, 2024, effective January 2025: [publication PDF](https://www.sss.gov.ph/wp-content/uploads/2024/12/CI-2024-006-Publication.pdf), [official table image](https://www.sss.gov.ph/wp-content/uploads/2024/12/Cir-2024-006-Employers-scaled.jpg). The image was downloaded and visually checked, including all 61 rows. The current [SSS contribution page](https://www.sss.gov.ph/pay-contribution/) still expressly lists the January 2025 schedule, remuneration definition, EC, and MPF rules. The [circular index](https://www.sss.gov.ph/sss-circulars/) identifies 2024-006 for business employers.
- **PhilHealth Advisory 2025-0002**, effective January 2025: [official advisory](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf), referring to [Circular 2020-0005](https://www.philhealth.gov.ph/circulars/2020/circ2020-0005.pdf). The advisory explicitly excludes commissions, overtime, allowances, thirteenth-month pay, bonuses and gratuities from MBS, and excludes deductions for absences, unpaid leave, tardiness and undertime from that computation. The [2026 advisory index](https://www.philhealth.gov.ph/advisories/2026/archives.php) was checked. Continued 2026 rates and equal sharing were corroborated by [PIA's May 14, 2026 report of PhilHealth's May 6 announcement](https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/); this is government corroboration, not a newly retrieved PhilHealth 2026 rate circular.
- **Pag-IBIG Circular 460**, issued January 15, 2024, effective February 2024: [official register entry](https://naro.law.upd.edu.ph/issuances/3217) and [agency-filed official copy](https://naro.law.upd.edu.ph/storage/01JQWKTTA92H57M9EWV31W8F1D.pdf), ONAR registration 24-0098. All five scanned pages were visually read. Sections B, C and F establish coverage, rates, fund-salary definition, ceiling and effectivity. Direct Pag-IBIG website requests were blocked by reCAPTCHA/unavailable; the actual agency issuance was verified through its official filed copy rather than a commercial summary. The [register's agency index](https://naro.law.upd.edu.ph/agencies/pag-ibig-fund) was checked; no replacement contribution schedule was found. Direct confirmation of no subsequent agency amendment remains a pre-integration requirement.

The engine conservatively accepts contribution months only through **October 2026**, the verification month. This is a verification cutoff, **not a statutory expiry date**. Later months throw `UNVERIFIED_SCHEDULE` until sources are rechecked and the verification window updated. Earlier unimplemented schedules also throw; there is no fallback to current rates for historical calculations.

## Rounding and unresolved decisions

- **SSS:** use the exact published table amounts. Salary ranges are lower-inclusive and upper-exclusive (e.g. 5,249.99 maps to MSC 5,000; 5,250 maps to MSC 5,500). Inputs with fractions smaller than a centavo are rejected, not rounded into another bracket.
- **PhilHealth:** [official rounding guidance](https://www.philhealth.gov.ph/news/2018/sample_compu.html), citing Advisory 2018-0003, rounds the total premium to the nearest centavo, half up, then assigns any odd centavo to the employer. Its published 309.375, 698.775 and 618.75 examples are tested as rounding examples only; the obsolete 2.75% rate is never used for current calculations. Confirm continued EPRS reconciliation behavior before integration.
- **Pag-IBIG:** Circular 460 specifies percentages but **does not specify fractional-centavo rounding**. Exact centavo results work; fractional-centavo liabilities throw `ROUNDING_UNVERIFIED`. For example, fund salary 1,500 yields EE 15 / ER 30; 1,500.50 yields EE 30.01 / ER 30.01; 1,500.01 is blocked. Agency confirmation is needed before adding a rounding rule. No arbitrary rounding convention is represented as law.

## API and allocation contract

`calculateSss`, `calculatePhilHealth`, and `calculatePagIbig` take explicit agency-specific monthly bases as decimal strings or `Prisma.Decimal`, plus contribution month, PHP currency, arrangement and resolved coverage. Monetary arithmetic uses `Prisma.Decimal`; table construction uses exact integer constants. Outputs include schedule/source/verification metadata, original and assessed bases, regular/MPF/EC component amounts, employee, employer, employer-only, employer total and total remittance. JSON serialization preserves Decimal strings; persisted money should be explicitly formatted to two decimal places in Phase 2.

Supported arrangement is explicitly attested `PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH`. Unknown coverage, missing bases, zero/negative/nonfinite/out-of-range money, foreign currency and unsupported arrangements throw typed errors. Full-month zero pay, partial months, midmonth salary changes, daily/hourly basis derivation, multiple employers, government/GSIS, kasambahay, OFW and self-employed cases require review; they do not silently produce zero. Membership numbers are not arithmetic inputs and must be validated by the later remittance integration. The existing compensation model alone does not establish agency bases or statutory coverage.

An explicit `EXEMPT` outcome requires legal basis, evidence reference and reviewer, and retains that evidence separately from calculated contributions. The caller must verify that exemption covers the agency liability including any employer-only component. This engine does not adjudicate exemption eligibility or treat an organization setting as exemption authority.

`allocateContribution` implements application policy `MONTHLY_ONCE_OR_HALF_THEN_RECONCILE_V1`:

1. Monthly: allocate the monthly liability once, with an explicitly empty month ledger.
2. Semi-monthly FIRST: allocate half of each employee/employer/employer-only component, rounded down to centavos.
3. Semi-monthly SECOND: require the actual posted FIRST allocation and allocate monthly liability minus posted amounts, component by component. Remainders settle here. Revised month totals can be reconciled upward; negative corrections or coverage/component changes require explicit adjustment review.
4. Reject duplicate cutoffs, mixed frequencies, wrong organization/employee/month/agency, corrupt prior amounts, inconsistent totals and missing first-cutoff history. Biweekly is not semi-monthly.

The function is a pure preview and cannot enforce database concurrency or recover an omitted ledger entry. Phase 2 must load the **complete persisted month ledger**, rehydrate Decimal strings, and enforce a transaction/lock plus a unique organization/employee/agency/month/cutoff key. Reusing an empty ledger on retries is invalid caller behavior. Allocation policy is an application decision, not an agency-prescribed twice-monthly deduction rule.

Example at SSS remuneration 35,000, PhilHealth MBS 35,000, Pag-IBIG Fund Salary 35,000:

| Agency | Employee | Employer counterpart | Employer-only | Total remittance |
| --- | ---: | ---: | ---: | ---: |
| SSS | 1,750.00 | 3,500.00 | 30.00 | 5,280.00 |
| PhilHealth | 875.00 | 875.00 | 0.00 | 1,750.00 |
| Pag-IBIG | 200.00 | 200.00 | 0.00 | 400.00 |

## Validation

- `node node_modules/tsx/dist/cli.mjs scripts/test-payroll-statutory.ts`: **93 passing tests**, covering all 61 SSS official rows at lower/middle/upper boundaries (183 table cases), EC/MPF transitions, PhilHealth floors/ceilings/rounding, Pag-IBIG thresholds/ceilings/unresolved rounding, invalid inputs, coverage, schedule dates, allocation totals/retries/reconciliation/isolation and input immutability. No database connection or environment-file loading.
- `node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2017 --module commonjs --moduleResolution node --esModuleInterop scripts/test-payroll-statutory.ts src/features/payroll/statutory/index.ts`: targeted strict TypeScript check.
- `node node_modules/eslint/bin/eslint.js src/features/payroll/statutory scripts/test-payroll-statutory.ts`: targeted lint.

## Phase 2 integration requirements

- Resolve earnings-component mapping independently for each agency; validate membership/age/coverage and reviewed exemptions. Address unsupported cases and Pag-IBIG rounding first; reconfirm official schedules before enabling deductions.
- Add semi-monthly compensation/period representation deliberately: current `PayFrequency` has MONTHLY, BIWEEKLY, WEEKLY, ANNUAL and HOURLY, **no semi-monthly value**. `calculateMonthlyCompensationBase` currently requires exact periods. No enum/schema changes were made here.
- Persist monthly liabilities, component breakdowns, source/schedule version, bases, coverage evidence, rounding and allocation policy, and actual allocations. Apply only employee allocations to net pay; employer counterpart and EC are separate liabilities.
- Preserve existing organization-specific attendance/leave/rounding policies. Statutory rates are immutable government schedules, with no percentage override API.
- Use atomic generation/retry/reversal handling and a complete monthly ledger; handle second-cutoff changes, insufficient net pay, separations and adjustments explicitly.
- Keep finalized `PayrollEntry.calculationSnapshot` and historical records immutable. Existing service snapshots are version H6.2.5 and contain compensation, organization policy and attendance/leave calculations. The existing review/payslip flow consumes them. Introduce a new snapshot version only for future integrated entries; no backfill/recalculation of finalized records.
- BIR withholding tax, payslip presentation, remittance reconciliation and live deductions remain for Phase 2. Phase 1 changes no existing payroll behavior.

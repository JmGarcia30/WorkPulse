# Payroll Phase 2A: BIR withholding and earnings classification

Verified **2026-10-22**. New pure module: `src/features/payroll/bir/`. Public payroll preview: `calculateBirWithholding`; mathematical table primitive: `assessBirTable` (not a payroll eligibility check). No generation/review/payslip hooks, database access, schema changes, migrations, environment loading, performance audits or changes to Phase 1/Hiring/Leave/Probation.

## Sources and effectivity

| Official source | Effect / implementation |
| --- | --- |
| [RR 11-2018](https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf), sections 2.78.1 and 2.79 | Compensation exclusions, mandatory employee contributions and union dues; ordinary withholding steps and exceptional cumulative/annualized methods. |
| [Annex E](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf) | **January 1, 2023 onward**. Separate monthly and semi-monthly tables, encoded directly as decimal-string thresholds/fixed taxes/rates; version `BIR-RR11-2018-ANNEX-E-2023`. |
| [RR 4-2025 full text](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%204-2025.pdf), [official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%204-2025.pdf) | Clothing ceiling rises to 7,000/year; qualifying achievement awards may be cash, gift certificates or tangible property. Issued/website-posted January 30, 2025; section 3 provides 15 days after first publication, giving **February 14, 2025** from that website date. The scanned full text, including effectivity, was visually inspected. |
| [RR 29-2025 full text](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025.pdf), [official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025%20digest%20FINAL.pdf) | Raises de minimis ceilings again. Website posting December 22, 2025, plus 15 days gives **January 6, 2026**; this date is also expressly confirmed by [NIA's circular containing the BIR issuance](https://omcrs.nia.gov.ph/?q=system/files/mc/2026_035.pdf). This is not retroactively selected from the document's October signature date. |
| [2025 BIR regulation index](https://www.bir.gov.ph/2025-Revenue-Regulations), [2026 index](https://www.bir.gov.ph/2026-Revenue-Regulations) | Checked for amendments: no replacement Annex E compensation table was found. RR 5/24-2025 and RR 5-2026 address other creditable-withholding categories, not this compensation table. The pages render dynamically; the search-indexed official listings supplied the publication metadata. |
| [RR 15-2025 official retirement-plan digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2015-2025.pdf) | Retirement exemptions have qualification requirements. Retirement/separation payments are explicitly unsupported here. |
| [RMC 105-2025 official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%20105-2025%20Digest%20FINAL.pdf) | Employee Health Emergency Allowance can fall in the shared 90,000 benefits exclusion; contractor treatment differs. Its dedicated classification is blocked pending entitlement/relationship validation rather than automatically treating it as taxable fixed allowance or unlimited exemption. |

Only payment dates **2023-01-01 through 2026-10-22** are accepted. The upper limit is a verification safeguard, not statutory expiry. Recheck official sources before extending it. Tax rules follow **payment date**; monthly contribution liabilities retain their own contribution-month identity.

Supported cash-benefit ceilings:

| Payment date | Rice/month | Clothing/year | Laundry/month |
| --- | ---: | ---: | ---: |
| 2023-01-01–2025-02-13 | 2,000 | 6,000 | 300 |
| 2025-02-14–2026-01-05 | 2,000 | 7,000 | 300 |
| 2026-01-06 onward, within verification window | 2,500 | 8,000 | 400 |

RR 29-2025 also changes vacation-leave monetization, dependent medical cash allowance, actual medical assistance, achievement awards, occasion gifts, qualifying meal allowances and combined CBA/productivity benefits. These categories require additional units, conditions, regional wage or supporting evidence; their dedicated classifications are not enabled. No old ceiling is silently applied to them.

## Model inspection and mapping

`EmployeeCompensation` currently stores effective-dated MONTHLY/DAILY base rates and `PayFrequency`; it does not store earnings lines, tax eligibility, benefit usage or statutory allocations. `PayFrequency` has no SEMI_MONTHLY value. `PayrollEntry` has aggregate base/gross/deductions/net plus `calculationSnapshot`. Generation currently makes gross equal base and subtracts organization attendance deductions. Snapshots use version H6.2.5; finalized payslips read those snapshots. None of these existing paths was edited.

The new input contract requires complete cash earnings, a gross control total, resolved profile, all three agency employee shares, explicit union dues (including zero), other net deductions (including an empty list) and complete benefit history before the current payment.

| Input earning / deduction | Treatment |
| --- | --- |
| `BASIC_SALARY`, `FIXED_ALLOWANCE` | Regular taxable earnings; generic allowances receive no automatic exemption. Amounts must already reflect legitimate salary reductions. |
| `OVERTIME`, `COMMISSION` | Taxable supplementary earnings for the supported non-MWE profile. |
| `RICE_SUBSIDY`, `CLOTHING_ALLOWANCE`, `LAUNDRY_ALLOWANCE` | Require entitlement evidence; use effective caps and prior exemption usage. Excess joins the annual other-benefits pool. |
| `THIRTEENTH_MONTH`, `QUALIFYING_OTHER_BENEFIT` | Require qualification evidence; share the annual 90,000 pool with excess de minimis. Only overflow is supplementary taxable pay. A benefit name is not proof of entitlement. |
| SSS, PhilHealth and Pag-IBIG mandatory employee shares | Excluded from regular taxable pay once, using the actual period allocation. SSS input includes its mandatory employee regular/MPF share. Employer counterpart/EC are not accepted as employee deductions. |
| Union dues | Separately evidenced employee exclusion and net-pay deduction. |
| Voluntary savings/top-ups, loans and other net deductions | Reduce net cash only, never the withholding base. Do not put these into mandatory statutory shares. |
| Other classifications / special exemptions / noncash benefits | Typed error; no default taxable or tax-free fallback. |

Benefit history is scoped to organization/employee/payment year/month and must be complete before the current payment. Repeated lines share the same remaining allowance; monthly caps are not reset per semi-monthly cutoff. Returned closing balances are previews, not persisted reservations. Annual other-benefits history includes eligible gross amounts already paid, including amounts already above the cap. Exempt de minimis amounts do not consume that pool.

For supported cash-only cases:

```
gross = regular earnings + supplementary earnings + benefits
taxable compensation = gross - exempt benefits - mandatory employee shares - union dues
net pay = gross - mandatory employee shares - union dues - withholding tax - other net deductions
```

The breakdown exposes each value, classified earnings, contribution references, benefit-rule version/balances, chosen tax bracket, exact unrounded tax, final tax, source URLs and a JSON-safe independent copy of the complete inputs. `nonTaxableBenefits` excludes contribution/union exclusions; `nonTaxableCompensation` includes them. No existing snapshot is modified.

## Calculation method, boundaries and limits

Each period uses its own table; semi-monthly tax is never a divided monthly tax. The supported payroll preview accepts full calendar months or 1–15 / 16–month-end cutoffs paid on/after period end. Other calendars, advances and off-cycle runs require separate handling.

For ordinary supplementary compensation, selection uses **regular taxable compensation**, then the selected bracket's rate applies to the excess including supplementary pay, following RR 11-2018 steps 3–4. This matters when a supplement crosses a bracket boundary. The mathematical primitive's `taxableCompensation` input means regular taxable pay; `supplementaryCompensation` is separate. The output exposes both and their total.

Printed whole-peso ranges are interpreted continuously to the centavo before the next threshold; no whole-peso truncation or invented 20,833.33 threshold. Tax at 20,833 monthly / 10,417 semi-monthly is zero. Exact published fixed taxes/rates are retained. Monetary inputs accept decimal strings or `Prisma.Decimal`, reject subcentavos and binary JS numbers, and use explicit **final-tax half-up centavo rounding** without intermediate rounding. Annex E does not separately describe half-cent ties; the explicit rounding convention should be reconciled with the filing/remittance implementation before live use.

Supported profile is a resident citizen/resident alien, private rank-and-file employee, one employer, explicitly not MWE. Unknown/MWE/special-profile cases fail. Previous employer in the same year, an already-required cumulative method, final pay or annualization requires a separate method and throws. Current supplementary pay also triggers an error when regular taxable pay is at/below the zero-tax threshold or supplementary pay is at least regular taxable pay. Calendar year-end is blocked automatically. The caller must derive the historical method flags from the complete year ledger; a missing flag cannot default to false.

The contribution input is a narrow boundary contract, not a fresh calculation of mandatory shares. It checks presence/uniqueness/scope/evidence and rejects unresolved zero mandatory shares. The future service must obtain these amounts from verified Phase 1 allocations; evidence must be genuine. Reviewed zero-share coverage needs a legal basis. Negative regular taxable pay or net pay fails instead of being clamped to zero.

## Verification

- **56 BIR tests passed**: every bracket in both tables, exact and adjacent-cent boundaries, zero-tax cases, half-cent rounding, rule dates, benefit caps/shared pool/history, taxable earnings, statutory exclusions, union/voluntary deductions, incomplete/unsupported inputs, exceptional-method guards, scope isolation, snapshots and Phase 1 allocation compatibility.
- **93 existing Phase 1 tests passed unchanged**. Total: **149 passing tests**.
- Targeted strict TypeScript and ESLint passed for the new module/tests and the Phase 1 module/tests.
- Published Annex E fixed-tax values are independent numeric fixtures. RR 11-2018 Illustrations 8/9 were checked for method: they use pre-2023 rates, and Illustration 9 has inconsistent printed totals. Tests explicitly distinguish repriced 2023 calculations from official historical results; no old example amount is presented as current tax. The [official BIR calculator](https://web-services.bir.gov.ph/tax_calculator/wt_calculator.html) corroborates classification/pool mechanics but has outdated de minimis descriptions, so current limits come from the amendments above.

### Quick Phase 2A verification — 2026-10-22

| Risk | Result | Verified behavior |
| --- | --- | --- |
| 1. Amendment dates and historical ceilings | PASS | RR 4-2025 effective February 14, 2025; RR 29-2025 effective January 6, 2026. Before/after date tests retain the rice/clothing/laundry ceilings listed above. Unsupported benefit categories remain blocked. |
| 2. De minimis versus annual 90,000 exclusion | PASS | Qualifying amounts within their own ceilings remain exempt even when the annual pool is exhausted. Only excess de minimis joins 13th-month/qualifying other benefits in the shared pool. |
| 3. Monthly/semi-monthly Annex E boundaries | PASS | Published thresholds, fixed taxes and rates match. Strengthened all adjacent-cent checks to assert bracket identity and unrounded tax, since rounded tax alone can hide a wrong bracket. Continuous centavo interpretation remains as documented above. |
| 4. Requested amounts | PASS | Monthly taxable 40,000 gives 3,208.40; semi-monthly taxable 20,000 gives 1,604.10. Added independent expected-value tests through both the table primitive and payroll preview after employee contributions. |
| 5. Employee statutory exclusions | PASS | Qualifying mandatory employee SSS/PhilHealth/Pag-IBIG shares reduce taxable compensation and net cash once; voluntary deductions affect net cash only. |
| 6. Employer contributions | PASS | Phase 1 allocation mapping uses only employee shares, excluding employer counterparts and EC. Added rejection tests for employer-share/EC treatment labels. The boundary still relies on verified allocation evidence; it cannot establish the provenance of a mislabeled employee amount. |
| 7. Unsupported MWE/special cases | PASS | Explicit errors for MWE/unknown profiles, special classifications and exceptional methods; no automatic zero-tax fallback. |

No calculator code corrections were necessary. Changes are limited to this report and the BIR test script: four added tests plus stronger existing boundary assertions. Local tests: 56 BIR + 93 unchanged Phase 1, zero failures; targeted strict TypeScript and ESLint passed. The initial sandboxed tsx attempts failed during Windows user-account lookup, before tests ran; the same commands passed when rerun with approved escalation. No production changes, migrations, pushes, live payroll integration or historical-record writes were performed. Existing Phase 1, BIR calculator, Hiring, Leave, Probation and historical payroll records were preserved.

Commands:

```
node node_modules/tsx/dist/cli.mjs scripts/test-payroll-bir.ts
node node_modules/tsx/dist/cli.mjs scripts/test-payroll-statutory.ts
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2017 --module commonjs --moduleResolution node --esModuleInterop scripts/test-payroll-bir.ts scripts/test-payroll-statutory.ts src/features/payroll/bir/index.ts src/features/payroll/statutory/index.ts
node node_modules/eslint/bin/eslint.js src/features/payroll/bir scripts/test-payroll-bir.ts src/features/payroll/statutory scripts/test-payroll-statutory.ts
```

## Exact Phase 2B integration requirements — not implemented

1. **Represent periods and inputs.** Add SEMI_MONTHLY deliberately to compensation/period handling, with explicit contribution month and cutoff identity. Add classified cash/noncash earnings, eligibility/entitlement evidence, tax residency/MWE status, and complete year-to-date benefit/tax history. The current rate/type/frequency fields are insufficient. Validate TIN and agency membership for filing separately from arithmetic.
2. **Resolve earnings by agency.** Build separate SSS remuneration, PhilHealth fixed basic salary before attendance deductions, Pag-IBIG Fund Salary and BIR cash earnings. Decide which attendance amounts are actual salary not earned versus fines/net deductions. Do not subtract a salary reduction again after feeding already-reduced earnings. Preserve existing organization policies; no statutory percentage override.
3. **Calculate monthly contributions, then allocate.** Call each Phase 1 monthly calculator once for the agency basis, followed by its allocation preview against the complete month ledger. FIRST uses half per component; SECOND reconciles the liability minus posted FIRST amounts. Feed only each allocation's mandatory employee share into BIR, scoped to the payroll period. Retain employer regular/MPF and employer-only EC separately.
4. **Persist atomic ledgers.** Introduce unique organization/employee/agency/contribution-month/cutoff allocation records plus a monthly frequency guard. Under one transaction with serialization/employee locks and retry handling, read/reconcile the complete month ledger, reserve/apply the allocation, update benefit usage and write the payroll entry/snapshot. Lock the employee's payment-year benefit/tax ledger too, so concurrent periods cannot reuse annual or monthly exemptions. Include draft regeneration, retries, cancellation and reversals; an empty ledger on retry is invalid. Do not rely on deterministic keys alone for concurrency safety.
5. **Handle exceptional tax methods before enabling affected payroll.** Implement cumulative-average history (including prior-employer Form 2316), method persistence for the remaining year, year-end/final-pay annualization/refunds, off-cycle/partial periods, special benefits and approved exemptions/MWE cases. Until then block affected payroll with actionable setup errors. Resolve annual-cap transition/reclassification policy with the payroll reviewer; this phase does not rewrite earlier payments.
6. **Version future snapshots and presentation.** New snapshots must contain gross/classified/exempt/regular/supplementary earnings, bases, source/schedule versions, employee/employer/EC components, allocation references and policy, BIR inputs/method/bracket/rounding, benefit balances, deductions and net. Deduct only employee amounts from take-home pay. Extend review and payslip readers by snapshot version; keep the H6.2.5 historical reader and finalized records immutable. No finalized-record backfill or recalculation.
7. **Resolve Pag-IBIG rounding and filing reconciliation.** Obtain official fractional-centavo guidance, encode/version that rule and add boundary fixtures before lifting Phase 1's `ROUNDING_UNVERIFIED` error. Do not insert zero or use the employer amount as the employee share. Reconfirm PhilHealth odd-cent sharing and BIR centavo/filing reconciliation. Refresh verified schedules/payment dates before production enablement.

Stopped after Phase 2A. No production writes, live deductions, migration, push or deployment.

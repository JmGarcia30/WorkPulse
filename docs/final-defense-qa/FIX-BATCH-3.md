# WorkPulse final-defense stabilization — Batch 3: payroll audit

Audit date: **2026-11-02, Asia/Singapore**. This is a findings report, not an authorization to change payroll code or release it.

## Decision

**NO-GO for a November 2026 payroll demonstration that claims current statutory compliance. CONDITIONAL GO for an explicitly historical, fictional September 2026 HR-to-ESS demonstration.**

The supported historical calculations passed. No incorrect statutory amount, duplicate posting, or payroll disclosure was reproduced in the executed scenarios. November payroll remains intentionally blocked by expired verification coverage. A source review established substantial agreement with the implemented rates, but did not establish every publication/effectivity detail and an exhaustive current BIR/Pag-IBIG amendment check. **No verification date was extended.**

One functional issue was reproduced: readiness can show a semi-monthly second cutoff as ready without a first-cutoff ledger. Generation correctly rejects it and creates no payslip. This is a P2 preflight problem, not a contribution calculation error.

Final results: **93 statutory test cases and 56 BIR test cases passed**, plus database suites with **56 integration, 24 workflow, 28 presentation/service, 15 leave/reconciliation/integrity, and 46 additional probe assertions**. Counts have different units and overlapping coverage; they are not a count of distinct end-to-end journeys. Browser authentication/rendering was not rerun in Batch 3.

Consolidated evidence: [final test summary](batch-3/evidence/final-test-summary.json), [report link/secret validation](batch-3/validation.json). The test-suite PASS status does not negate the readiness finding or the blocked current-date workflow.

## Preservation and test isolation

No application code, existing script, dependency, environment file, Prisma schema, or migration was changed. No migration, production payroll generation/finalization, push, deployment, or government remittance was executed. New files are this report and `batch-3/` only.

The original uncommitted Batch 1 edits remain:

- `scripts/test-staff-session-security.cjs`
- `src/features/hiring/actions.ts`
- `src/lib/auth/session.ts`

All **1,980 preexisting tracked/untracked files and explicitly included environment files** fingerprinted by the audit remain unchanged, including Batch 1/2 reports and evidence. HEAD is unchanged. See [preservation](batch-3/preservation.json) and [audit harness](batch-3/audit.cjs). Ignored generated caches are outside that file manifest.

Tests used the existing recovery database, not a newly provisioned empty database:

| Identity | Verified value |
| --- | --- |
| Neon project | `late-block-61364102` |
| Recovery branch | `workpulse-ess-design` / `br-damp-fog-azmmxhga` |
| Recovery endpoint | `ep-wild-mud-az8yzifu` |
| Database/schema | `neondb` / `public` |
| Provider branch status | Nonprimary, nondefault; separate from production branch `br-hidden-violet-azjl3vam` |
| Live identity check | Exact branch/endpoint/database/schema matched under enforced read-only connection |
| Repository/applied migration check | 39 successful migrations; checksums matched allowing LF/CRLF normalization |
| Migrations executed | **0** |

Connected Neon branch/compute metadata was independently checked against the local recovery profile and live PostgreSQL identity. The harness also rejects the protected original endpoint. It reads credentials in memory and scrubs output; no credentials were printed or changed. See [live target and table fingerprints](batch-3/evidence/target.json) and [reviewable runner](batch-3/run.cjs).

This recovery branch contains inherited records. Fixtures were confined to newly created fictional tenants/employees. Most scenarios rolled back entire transactions; the existing concurrency suite temporarily committed its fictional tenant and then removed only its own records. **All 73 preexisting public business-table row counts and content fingerprints matched afterward**, on both the first run and the probe rerun: [first preservation](batch-3/evidence/initial-database-preservation.json), [final preservation](batch-3/evidence/database-preservation.json). Migration history was inspected, not edited. No production business data was queried or changed by this payroll harness.

Opening balances and contribution ledgers were controlled fictional fixtures, never representations of real employee history. The inherited phase-3 suite reads only recovery SAGA policy metadata/aggregate compensation kinds; it does not generate or finalize real SAGA payroll. Its SAGA metadata is excluded from this batch's saved result.

## Existing implementation audit

| Area | Implementation and observed boundary |
| --- | --- |
| Compensation | `service.ts:32`, `domain.ts:63`: fixed monthly basic salary; monthly means one complete calendar month. Semi-monthly stores the **full monthly salary**, allocates half to 1–15 and the remainder to 16–month-end, including odd salary centavos. Arbitrary cutoffs fail. |
| Contributions | `statutory/calculator.ts:111`, `schedules.ts:37`: SSS published brackets and separate regular/MPF/EC components; PhilHealth basic-salary floor/ceiling and odd-centavo split; Pag-IBIG employee/employer rates and cap. |
| Cutoff allocation | `statutory/allocation.ts`, `statutory-integration.ts:69`: first allocation reserves component shares; second reconciles actual monthly liability minus first allocation. Missing/unfinalized first payment, negative corrections, duplicate allocation, and within-month frequency changes are blocked. |
| Agency bases | `statutory-inputs.ts`, `standard-profile.ts`, `statutory-integration.ts:36`: explicit reviewed remuneration per agency; PhilHealth must equal full monthly basic before attendance deductions. Basic-only shortcut requires confirmations and does not invent opening history. General earning-to-agency mapping remains a reviewer responsibility. |
| BIR | `bir/rules.ts:22`, `bir/table.ts:6`, `bir/calculator.ts:79`: Annex E monthly/semi-monthly tables, regular versus supplementary earnings, employee mandatory shares/union dues excluded, employer shares excluded from employee deductions. |
| Benefits | `bir/earnings.ts:40`: supported qualified rice/clothing/laundry benefits, shared annual other-benefits pool, explicit entitlement evidence and prior usage. Ordinary allowances remain taxable. Unsupported classifications fail. |
| Attendance/leave | `service.ts:176`, `service.ts:196`, `service.ts:254`: resolved attendance required when a deduction policy consumes it; explicit late/absence/undertime parameters; salary reduction distinguished from net deduction. Monthly unpaid leave blocks generation; paid leave can proceed. |
| Opening/YTD | `statutory-integration.ts:47`: persisted complete opening history, strictly ordered finalized payments, benefit-usage deltas, before/after taxable and withholding YTD. Unknown balances never default to zero. YTD accumulation does **not** implement cumulative-average or annualized withholding. |
| Review/finalize | `review.ts:65`, `review.ts:191`, `review.ts:242`: fresh transaction/locks, explicit `FINALIZE`, complete eligible-employee entries, snapshot/totals/ledger/attendance consistency. Corrupted reservations and incomplete payroll fail. |
| ESS publication | `payslip.ts:117` onward: both period and entry must be finalized; active linked employee account and tenant ownership required. Finalization makes the payslip available automatically; there is no separately tested publication/release step. |
| Readiness | `readiness.ts:10`: validates a subset of setup, salary, schedule, history and attendance requirements. It does not run all generation/ledger checks. See B3-002. |

ESS pages call authenticated employee context before the scoped services: `src/app/(employee)/employee/payroll/page.tsx` and `src/app/(employee)/employee/payroll/[entryId]/page.tsx`. This routing was inspected; HTTP/session/browser behavior was not newly exercised.

### Expired verification and stale documentation

- [Contribution schedules](../../src/features/payroll/statutory/schedules.ts:2): verified on **2026-10-22**, through contribution month **2026-10**. November throws `UNVERIFIED_SCHEDULE` for every agency.
- [BIR rules](../../src/features/payroll/bir/rules.ts:2) and [validation](../../src/features/payroll/bir/validation.ts:28): payment dates after **2026-10-22** throw `UNVERIFIED_RULES`. This also bounds current benefit classification. Thus October month-end is already blocked, even though October contributions alone are accepted.
- `docs/payroll-phase-3-production-prerequisites.md` is explicitly dated October 23 and describes a 25-migration recovery snapshot. It is historical; this audit observed 39. Batch 2's separate production-binding/release gates remain in effect. Neither older document nor this recovery check establishes the active deployment's database binding.

## Official statutory evidence and comparison

Access date for the following sources: **2026-11-02**. Publication, signature, filing and effective dates are recorded separately. An unknown publication date is not replaced by the retrieval date. Downloaded originals and SHA-256 digests are in the [source manifest](batch-3/sources/manifest.json). Scanned pages were read through their extracted original JPEG images because PDF text extraction was empty.

| Source | Issue/signature; publication evidence | Effective period and comparison |
| --- | --- | --- |
| **SSS Circular 2024-006**: [agency table](https://www.sss.gov.ph/wp-content/uploads/2024/12/Cir-2024-006-Employers-scaled.jpg), [publication PDF](https://www.sss.gov.ph/wp-content/uploads/2024/12/CI-2024-006-Publication.pdf); [local table](batch-3/sources/sss-table.jpg) | Signed **2024-12-19**. Exact newspaper publication date not established in this review. | January 2025 onward: MSC 5,000–35,000 in published brackets; EE 5%, ER 10%; regular portion capped at MSC 20,000, excess MPF; EC employer-only 10/30. All 61 implemented rows agree with the agency table; boundary fixtures pass. |
| **SSS current agency archive and statement**: [circular archive](https://www.sss.gov.ph/sss-circulars/), [October 30, 2026 statement](https://www.sss.gov.ph/news-and-updates/sss-dict-sign-partnership-to-expand-social-security-coverage-for-freelancers/) | Statement dated **2026-10-30**; archive has no displayed publication date. | Archive continues to identify 2024-006 for business employers. October statement corroborates 15% and MSC bounds, but concerns freelancers; its self-employed sharing is not substituted for business EE/ER sharing. No conflicting business contribution schedule was found in the inspected archive. |
| **PhilHealth Advisory 2025-0002**: [agency PDF](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf), [Circular 2020-0005](https://www.philhealth.gov.ph/circulars/2020/circ2020-0005.pdf) | Advisory PDF/2025 archive does not establish an exact publication date. Underlying circular dated **2020-02-19**. | January 2025 parameters: total 5%, basic-salary floor 10,000, ceiling 100,000. Basic excludes listed extras and is not reduced by lateness/absence/undertime/unpaid leave. Code agrees. |
| **PhilHealth Advisory 2026-0042**: [agency PDF](https://www.philhealth.gov.ph/advisories/2026/PA2026-0042.pdf), [publication archive](https://www.philhealth.gov.ph/advisories/2026/archives.php); [government 2026 announcement](https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/) | Signed **2026-07-21**; Manila Bulletin publication **2026-07-29**. PIA announcement **2026-05-14**. | Agency reiterates 5% for direct contributors; PIA explicitly confirms 2026 floor/ceiling and equal employed-member sharing. Supports continued ordinary employed-member parameters. Proposed premium-reduction bills were not treated as enacted rules. |
| **PhilHealth rounding guidance**: [agency computation examples](https://www.philhealth.gov.ph/news/2018/sample_compu.html) | Published **2018-04-03**. | Round the total premium to centavos; employer absorbs an odd centavo. Implementation agrees. The old article's 2.75% rate is not used. |
| **Pag-IBIG Circular 460**: [official filed copy/catalog](https://naro.law.upd.edu.ph/issuances/3217), [PDF](https://naro.law.upd.edu.ph/storage/01JQWKTTA92H57M9EWV31W8F1D.pdf); [DBM implementation circular](https://www.dbm.gov.ph/wp-content/uploads/Issuances/2024/Circular-Letter/CIRCULAR-LETTER-NO-2024-2-DATED-FEBRUARY-01-2024.pdf) | Issued **2024-01-15**, ONAR filed **2024-01-24**. Actual publication date not established. DBM circular dated **2024-02-01**. Filing/certified-copy stamps are not publication proof. | February 2024 onward: employee 1% at fund salary ≤1,500, otherwise 2%; employer 2%; maximum fund salary 10,000. Broader remuneration/allowances basis, separate employer liability. Code agrees for supported employees and exact-centavo amounts. No fractional-centavo rounding direction was established. |
| **BIR RR 11-2018 / Annex E**: [regulation](https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf), [Annex E](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf) | Regulation dated **2018-01-31**; exact original publication date not re-established. Annex identifies its own effective date. | Annex E effective **2023-01-01 onward**. Every encoded monthly/semi-monthly threshold, fixed tax and percentage agrees. Regulation supports employee mandatory-share/union-dues exclusion, the shared 90,000 benefit pool, ordinary supplementary computation and exceptional-method requirements. |
| **BIR RR 4-2025**: [official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%204-2025.pdf), [full regulation](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%204-2025.pdf) | Digest identifies issuance **2025-01-30**. Exact first-publication event was not independently recovered in this batch. | Clothing ceiling 7,000 agrees with intermediate code version. Code's **2025-02-14** transition is inherited; exact publication-based boundary remains a verification limitation here. |
| **BIR RR 29-2025**: [full regulation](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025.pdf), [official digest](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025%20digest%20FINAL.pdf) | Full text dated **2025-10-27**, approval stamp **2025-11-18**, records-received stamp **2025-12-22**; digest calls it issued **2025-12-22**. These are distinct events. | Supported rice 2,500/month, clothing 8,000/year, laundry 400/month agree. Section 3 makes effectivity 15 days after first Gazette/BIR-web publication. Code uses **2026-01-06**; arithmetic from Dec 22 is consistent, but first-publication evidence remains incomplete. Other newly listed benefit categories remain unsupported. |

The [BIR 2025 index](https://www.bir.gov.ph/2025-Revenue-Regulations) and [2026 index](https://www.bir.gov.ph/2026-Revenue-Regulations) returned a loading shell in the research tool. Direct BIR PDFs were accessible. Search results and a records-received stamp do not establish an exhaustive November amendment review or legal first publication. The direct Pag-IBIG website fetch initially failed; the agency's filed circular was subsequently downloaded from the official UP Law register and all five pages inspected. A complete latest Pag-IBIG amendment inventory was not established.

**Date-update recommendation:** SSS and ordinary PhilHealth parameter comparisons have current official corroboration and can support a separately reviewed, bounded update proposal. Do not change the shared verification constant as a blanket fix. Retain BIR/Pag-IBIG current-date restrictions until the outstanding current-issuance/publication checks are documented. Keep the Pag-IBIG fractional-centavo guard even if dates are later approved. No statutory rate correction is supported by the executed comparisons.

### Rule details that are implementation conventions or unsupported cases

- Semi-monthly allocation is a controlled settlement convention; source monthly liabilities must be reconciled once across both cutoffs. Tests establish internal conservation, not an agency mandate to deduct exactly half at each cutoff.
- BIR uses final half-up centavo rounding and continuous centavo intervals between printed whole-peso thresholds. Tests verify that convention and printed bracket identity. Annex E does not itself resolve every fractional-centavo/filing convention; filing reconciliation remains outside this audit.
- General benefit qualification, statutory coverage, agency remuneration mapping and historical exceptional-method flags require genuine reviewer evidence. A checked confirmation does not independently validate real-world entitlement/history.
- Unsupported government/household/self-employed/multiple-employer or special tax profiles cannot be made supported by changing rates or supplying fake exemption evidence.

## Independent calculation comparisons

All amounts are PHP. Historical integrated scenarios use **September 2026**; they do not establish November compliance. Expected figures were derived from the official table/formula and explicit fictional inputs, without calling the WorkPulse calculator to produce expected values. Actual figures below were asserted against generated database entries/snapshots or pure results. See [additional oracle cases](batch-3/evidence/probes.json), [probe source](batch-3/probes.cjs), [integration suite](../../scripts/test-payroll-integration.ts), and [reconciliation result](batch-3/evidence/phase3.json).

| Scenario | Independent expected | WorkPulse actual | Result |
| --- | --- | --- | --- |
| Monthly basic 35,000: contributions | EE SSS 1,750; PhilHealth 875; Pag-IBIG 200. ER 3,500 + EC 30; PhilHealth 875; Pag-IBIG 200. | Same, separately snapshotted | PASS |
| Same monthly employee: BIR/net | Taxable = 35,000 − 2,825 = **32,175**. Tax = (32,175 − 20,833) × 15% = **1,701.30**. Total deductions **4,526.30**; net **30,473.70**. | 32,175 / 1,701.30 / 4,526.30 / 30,473.70 | PASS |
| Each equal semi-monthly cutoff of 35,000 | Basic 17,500; EE shares 875 + 437.50 + 100 = 1,412.50. Taxable **16,087.50**; tax = (16,087.50 − 10,417) × 15% = 850.575 → **850.58**. Net **15,236.92**. | Same on both cutoffs; monthly contributions counted once | PASS |
| Salary with odd centavo | Monthly 35,000.01 → first basic **17,500.00**, second **17,500.01** | Same | PASS |
| SSS bracket boundaries | 5,249.99 → MSC 5,000 / EE 250; 5,250 → MSC 5,500 / EE 275; 14,749.99 → EE 725 / EC 10; 14,750 → EE 750 / EC 30 | Same; additional MPF/cap rows also match | PASS |
| PhilHealth floor/cap and odd share | Basic 9,000 → EE/ER **250/250**; 150,000 → **2,500/2,500**; 10,000.20 × 5% = 500.01 → **250.00/250.01** | Same | PASS |
| Pag-IBIG boundary/cap | Fund salary 1,500 → **15/30** EE/ER; 1,550 → **31/31**; 9,999 → **199.98/199.98**; ≥10,000 → **200/200** | Same | PASS |
| Attendance policy: 600 late seconds × 1/min, one absence × 100, 120 undertime seconds × 10/min | Late **10**, absence **100**, undertime **20**. First two reduce salary; undertime is a net deduction. Taxable **32,065**, tax **1,684.80**, net **30,360.20**. PhilHealth EE stays **875**. | Same; no double deduction | PASS |
| Mixed earnings and evidenced fictional YTD | Basic 35,000 + allowance 1,000 + overtime 2,000 + rice 2,500 + laundry 400 + clothing 8,000 + bonus 1,000 = gross **49,900**. Prior benefit pool 89,500 leaves bonus exemption 500. Exempt benefits **11,400**; employee contributions **2,825**; taxable **35,675**. Regular bracket selected on **33,175**, supplementary **2,500** → tax **2,226.30**, net **44,848.70**. | All figures match | PASS |
| Same mixed fixture: opening taxable 200,000 / withholding 10,000 | After payment taxable YTD **235,675**, withholding YTD **12,226.30** | Same | PASS |
| Upward second-cutoff SSS remuneration: 30,000 → 32,000, overtime 2,000 on second cutoff | EE SSS first **750**, second **850**, monthly **1,600**. Second gross **17,000**, BIR **788.70**, net **14,886.30**. | Same | PASS |

Two semi-monthly withholding amounts total 1,701.16 versus monthly withholding 1,701.30. This follows the separately printed frequency tables/rounding; the engine must not force monthly tax by dividing it in two. It does not eliminate the need for year-end reconciliation.

For the mixed fixture, reviewed SSS/Pag-IBIG bases were 38,000; their caps make the result insensitive to additional above-cap remuneration. This test proves classification/ledger arithmetic and does not certify a universal earning-to-agency mapping.

### Current-date comparisons — deliberately blocked

| Executed scenario | Observed result |
| --- | --- |
| Pure SSS, PhilHealth and Pag-IBIG at contribution month 2026-11 | Each throws `UNVERIFIED_SCHEDULE`; no numerical output |
| Pure BIR payments 2026-10-23, 2026-11-02, 2026-11-15, 2026-11-30 | Each throws `UNVERIFIED_RULES` |
| November monthly and first semi-monthly payroll with otherwise complete fictional configuration | Readiness false; generation creates zero entries and zero statutory postings |
| Historical September period paid on actual audit date 2026-11-02 | BIR date guard blocks generation; zero statutory postings |

These are **PASS for safety guards / BLOCKED for payroll completion**, never a passing current-date calculation or current-date payslip demonstration. No system clock or verification constant was changed to make them pass.

## Test execution matrix

| Requested area | Result and evidence |
| --- | --- |
| 1. Monthly salary configuration | PASS: accepted valid monthly salary, rejected negative rate, overlapping/effective-date mismatch; semi-monthly rate interpreted as monthly salary. [Workflow](batch-3/evidence/workflow.json), [probes](batch-3/evidence/probes.json) |
| 2. Semi-monthly cutoffs | PASS historical: canonical cutoff checks, odd centavo, missing/unfinalized first allocation, upward reconciliation, monthly frequency guard. [Statutory log](batch-3/evidence/statutory.log), [integration](batch-3/evidence/integration.json), [phase3](batch-3/evidence/phase3.json) |
| 3. Government contributions | PASS historical: 93 pure test cases, all SSS rows/adjacent boundaries, PhilHealth split/floors/cap, Pag-IBIG rates/cap. [Statutory log](batch-3/evidence/statutory.log) |
| 4. Withholding | PASS historical: 56 pure cases covering all monthly/semi-monthly brackets and boundaries, deductions and exceptional-method rejection. Current dates BLOCKED. [BIR log](batch-3/evidence/bir.log) |
| 5. Taxable/nontaxable earnings | PASS: ordinary allowances, supplementary income, qualified caps, shared annual pool exhaustion, missing qualifications/unsupported types rejected; mixed database oracle matched. [Probes](batch-3/evidence/probes.json) |
| 6. Attendance/leave deductions | PASS supported late/absence/undertime and paid-leave calculations; unpaid monthly leave correctly BLOCKED before generation and at finalization. [Integration](batch-3/evidence/integration.json), [leave probe](batch-3/evidence/unpaid-leave-probe.json), [phase3](batch-3/evidence/phase3.json) |
| 7. Opening/YTD | PASS explicit nonzero opening balances, benefit usage deltas and earlier finalized postings; missing/invalid/untracked history rejected. Cumulative-average/annualized computation UNSUPPORTED, not executed as a successful calculation. |
| 8. Generation/readiness | Generation PASS historical; retries preserve entries/allocations and failed calculation leaves no partial reservations. **Readiness contract FAIL: B3-002.** November completion BLOCKED. |
| 9. Review/finalization | PASS historical: empty draft, wrong confirmation, not-in-review, incomplete/corrupted ledgers, role checks, immutable snapshots, serialized concurrency. [Integration](batch-3/evidence/integration.json), [workflow](batch-3/evidence/workflow.json) |
| 10. ESS visibility | PASS service boundary: drafts/review hidden; own finalized visible; HR/ESS same stored calculation; legacy amounts preserved without invented statutory zeros. [Presentation](batch-3/evidence/presentation.json), [probes](batch-3/evidence/probes.json). Actual signed-in browser NOT EXECUTED. |
| 11. Isolation | PASS: cross-tenant generation/setup/payslip denial, same-tenant different-employee denial, disabled account denial, unauthorized manager/employee actions, composite DB ownership protection. |
| 12. Duplicate/invalid/incomplete records | PASS: concurrent retries, duplicate allocation unique key, malformed setup/earning data, incomplete history, invalid date/rate, missing ledger, frequency mismatch and tamper rejection. |

The [first-run summary](batch-3/evidence/summary.json) records four successful suites and an initial probe failure. The initial probe attempted an incomplete synthetic account-disable update and hit `EmployeeAccount_state_check` because `disabledAt` was missing; see [original failure](batch-3/evidence/probes-initial.json). After fixing only the new harness fixture, the [probe rerun](batch-3/evidence/probes-summary.json) passed 46 assertions. This was not an application payroll failure. Both attempts preserved preexisting database contents.

Initial sandboxed pure-test attempts failed in the tsx Windows user-info loader before tests ran; rerunning with approved escalation passed. The initial sandboxed read-only database attempt could not connect; the approved external connection then verified the exact target. [Initial connection error](batch-3/evidence/runner-error.json) is retained as attempt evidence, not the final target verdict.

Not executed: new full browser HR-to-ESS journey, actual payment/disbursement, agency remittance/file submission, BIR 2316/annual reconciliation, production configuration/employee-history validation, production security penetration testing, or broad build/lint reruns. No application source changed, and prior Batch 1/2 build results are not relabeled as new Batch 3 execution.

## Findings, severity and required corrections

| ID / severity | Classification, root cause and code location | Required action for review — not implemented |
| --- | --- | --- |
| **B3-001 — P1** | **Current core payroll unavailable**, not a reproduced wrong rate. Shared contribution coverage ends October; BIR/benefit coverage ends Oct 22. `statutory/schedules.ts:2`, `statutory/calculator.ts:65`, `bir/rules.ts:2`, `bir/validation.ts:28`, `bir/earnings.ts:40`. Complete fictional November setup still cannot calculate. | Finish outstanding official evidence review; propose only supported, independently bounded agency/BIR/benefit coverage changes and regression fixtures. Keep restrictions until approved. Changing dates alone without evidence is not an acceptable correction. |
| **B3-002 — P2** | **Misleading preflight readiness.** `readiness.ts:10` checks configuration and date/rate availability but omits first-cutoff ledger requirements enforced by `statutory-integration.ts` / `statutory/allocation.ts`. Reproduced `ready=true`, followed by `INVALID_ALLOCATION: Second cutoff requires exactly one posted first cutoff.` | Include the relevant ledger prerequisites in readiness, or explicitly present it as configuration completeness and expose outstanding generation requirements. Preserve the generation guard. [Exact reproduction](batch-3/evidence/probes.json). |
| **B3-003 — P2 limitation** | **Unresolved Pag-IBIG rounding**, not a wrong returned amount. `statutory/calculator.ts:141`: 1,500.01 × 2% has subcentavo precision; explicit `ROUNDING_UNVERIFIED`. Ordinary above-cap salaries are unaffected. | Obtain agency rounding evidence before adding a rule. Preserve the rejection meanwhile; do not round arbitrarily or alter employee bases to manufacture a payslip. |
| **B3-004 — P1 capability limitation** | **Exceptional tax methods absent.** `bir/calculator.ts:63`, `bir/table.ts:12`: previous-employer/cumulative/annualized/final-pay scenarios reject. Stored YTD is bookkeeping, not an implemented exceptional method. | Exclude these cases from the supported demo. Any future method implementation needs separate approval and independent legal/financial calculations; no false profile flags to force ordinary withholding. |
| **B3-005 — P2 capability limitation** | **Monthly unpaid leave/partial-month salary handling absent.** `service.ts:196`, `review.ts:119`, `statutory-integration.ts:39`: approved unpaid leave blocks; one unchanged employment/compensation must cover the full contribution month. | Use only genuinely supported fictional scenarios. Any future unpaid-leave/proration method requires a reviewed policy and explicit tax/agency basis handling. Do not reclassify a real unpaid leave as paid. |
| **B3-006 — P3 documentation** | Older payroll prerequisites describe the October 23 recovery migration count, which differs from the verified 39-migration recovery database. Historical report context can be mistaken for current release evidence. | Use this dated audit and Batch 2's release gates for current review. Preserve original historical reports; a later documentation update can link them to the newer evidence. |

**P0:** none reproduced within the executed service/DB scenarios. This does not certify all production or HTTP security. **Numerical statutory calculation errors:** none reproduced in supported scenarios. B3-003/004/005 are explicit unsupported cases, not missing employee configuration and not silently calculated payslips.

**Configuration-only blockers, with no code fix established:** missing/overlapping/inapplicable salary; missing agency coverage or remuneration evidence; incomplete opening balances; historical payroll without a reconciled ledger; unresolved attendance; and absent first-cutoff payment. Synthetic tests proved these restrictions. Actual SAGA employee configuration was not audited, so no real employee is labeled ready or defective.

## Demonstration scope and stop point

A complete **historical payroll service flow is currently possible**: fictional hired employee → monthly salary/configuration → evidenced fictional opening ledger → September generation → review → explicit finalization → authorized employee ESS payslip service. Monthly and both semi-monthly paths passed. Use clearly labeled fictional history; no zero balances or contribution facts may be inferred for a real employee.

A complete **signed-in browser demonstration is not newly certified**: this batch did not rehearse the entire UI/login sequence. Conditional historical GO requires a separate browser rehearsal using the same disposable target, supported dates/employee profile, and no unsupported unpaid leave or exceptional tax cases. The existing active employee-account requirement must also be satisfied.

**November/current-date end-to-end payroll remains NO-GO** because the engine blocks its calculation, and full current legal verification remains incomplete. Historical test success cannot be presented as current compliance, actual SAGA readiness, production authorization, or evidence of agency filing/remittance.

No payroll correction has been implemented. Stop here for review of the findings and approval of only the necessary changes.

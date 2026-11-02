# WorkPulse final-defense QA report

Assessment date: **2026-11-02, Asia/Singapore**. Testing began 2026-11-01 16:18 UTC. This is a test-only review; no application fixes, pushes, or deployments were performed.

## Executive summary

**NO-GO for an unrestricted, current-date, production-backed demonstration.** A narrower demonstration using synthetic data and supported historical payroll dates is a **conditional candidate**, subject to a complete rehearsal and the limitations in [DEMO-READINESS.md](DEMO-READINESS.md).

The application compiles and many important services work, but that does not establish complete defense readiness. The protected production database is missing the company-registration OTP migration. November payroll cannot run under the application's current verified statutory coverage; BIR coverage also excludes October 23 onward. A rejected job edit was observed deleting existing structured requirements. Kiosk authorization leaves a revoked HR cookie in the browser. Repository lint fails. Some older regression suites are incompatible with current prerequisites, and not every requested workflow has a completed browser test.

Positive evidence includes:

- Prisma schema validation, TypeScript, and optimized production build passed.
- All **39 migrations** replayed successfully into an empty synthetic schema.
- **93 statutory tests and 56 BIR tests** passed. Independent published-rule sample checks also passed.
- Payroll workflow, integration, statutory allocation, and payslip suites passed: **24, 56, 15, and 28 assertions**, respectively.
- Registration passed **61 service assertions** and **27 actual browser/SMTP/concurrency checks**, including cross-device verification, resend, first HR login, branding, and legacy links.
- Platform onboarding passed **60 assertions**; tenant routing/security passed **64**; production staff-session security passed **63**.
- Recruitment passed **61 real-PostgreSQL checks**, including Teaching/Non-Teaching conversion and concurrent stage/conversion operations. Another **63 offline functional groups** passed.
- Attendance passed **39 assertions** in a fresh schema. Leave passed **103 assertions**. ESS, final-pay, and resignation suites passed.
- RFID's final HTTPS browser run passed **21 scanning/workflow assertions**, including keyboard input and HR/ESS synchronization, while separately **failing HR-cookie removal**. The overall suite exits 1; it is not reported as an overall pass.
- **57 route/viewport checks** passed: 19 HR routes at widths 1280, 390, and 320. This establishes basic rendering and page-width behavior, not full interactive coverage.

These counts have different units and overlap; they must not be added together as a single count of end-to-end tests.

## Tested revision and repository state

| Item | Observed value |
|---|---|
| Repository | `JmGarcia30/WorkPulse` |
| Tested branch | `main` |
| Tested commit | `cfcbd8512edbc3e74148e2541ed03bc9f37ec3cd` |
| Commit subject | Simplify payroll setup and refresh public application and platform login |
| GitHub `main`, fetched read-only | `c820c5207d66399fd8d5bd2cef4c19332d87935b` |
| Difference | Three newer commits; three careers/application files, 32 insertions and 5 deletions |
| Newer changes reviewed | SAGA application light theme, warm-gold accents, job-detail Apply-button colors |
| Initial working tree | Clean |
| Application changes during QA | None |

The fetched changes were inspected but **not merged or executed**. Results apply to the tested commit, not an assertion that remote HEAD or the deployed application passed. The deployed code SHA and live deployment environment were not independently established. No checkout or teammate redesign files were overwritten.

The five initially inspected commits were `cfcbd85`, `b8ed5a7`, `e0a6149`, `c457e05`, and `5063e6b`. Their areas include payroll quick-start, registration OTP, HR/ESS redesign, platform login, and public job links.

## Environment and isolation

Windows/PowerShell; Node **24.18.0**; Next **16.3.6**; Prisma/client **6.19.3**; TypeScript **5.9.3**; ESLint **9.39.5**. Relevant installed Next environment-variable and production-checklist guides were read before harness implementation.

The `.env` database was treated as protected production. Live identity matched the branch identified as production by the repository's prior release evidence. Queries were limited to database identity, migration history, and schema metadata, with `default_transaction_read_only=on`. No production business records were selected or changed.

The development profile resolved to branch `br-damp-fog-azmmxhga`, endpoint `ep-wild-mud-az8yzifu`, profile name `workpulse-ess-design`. Its endpoint differed from protected production. Live branch and endpoint identity were checked before each isolated run. Existing development tables were not used as test fixtures.

Tests used **new empty PostgreSQL schemas on that separate development branch**, not a newly provisioned server/database. Schemas were named with random `batch3_test_` or `staff_auth_test_` prefixes, and migrated from repository SQL. Every application/test database URL explicitly selected its schema and search path. This provides schema isolation within a development database; it is not a distinct database credential boundary. Tests were trusted repository scripts, not untrusted SQL. Database-global migration locks occasionally caused setup timeouts; safeguards were retained and setup was retried/serialized.

External Gmail, organization OAuth, AI, and Blob credentials were disabled in test child processes. Registration used a loopback SMTP server accepting only `@fixture.invalid` recipients. OTPs/passwords/session credentials were not included in reports. Changing synthetic expiry timestamps was limited to test records. No clock or statutory safeguard was disabled.

The QA harness and evidence are under this report directory. Some existing scripts write historical reports; these writes were redirected into QA evidence. Two generated historical artifacts were preserved under QA evidence and restored to their clean baseline. Protected environment-file hashes and cleanup results are recorded separately. See [execution index](evidence/execution-index.json), [environment](evidence/environment.json), and [isolation manifest](evidence/isolation.json).

Final cleanup removed **32 manifest-owned QA schemas**, after rechecking the development branch and excluding the protected endpoint. Nested browser/exit schemas were disposed by their own suites. No preexisting schema was selected for cleanup. [Cleanup evidence](evidence/cleanup.json). All three original environment files have unchanged SHA-256 hashes. Final report-link and configured-secret scans passed: [validation](evidence/deliverable-validation.json).

## Environment checks and migration comparison

| ID | Check | Result | Evidence |
|---|---|---|---|
| ENV-001 | Current revision, clean initial tree, recent commits, remote comparison | PASS; remote ahead limitation | Revision table above; remote fetch performed without merge |
| ENV-002 | `prisma validate` | PASS | [Log](evidence/ENV-002-prisma.log) |
| ENV-003 | `tsc --noEmit --incremental false` | PASS | [Result](evidence/ENV-003-typescript.json) |
| ENV-004 | ESLint baseline, excluding new QA harness | **FAIL: 100 errors, 61 warnings** | [Log](evidence/ENV-004-lint.log) |
| ENV-005 | `next build --webpack`, optimized production build | PASS | [Log](evidence/ENV-005-build.log) |
| ENV-006-P | Protected production history and checksums | **38/39 applied; one pending** | [Metadata](evidence/database-protected.json) |
| ENV-006-D | Existing development history and checksums | PASS: 39/39 applied | [Metadata](evidence/database-development.json) |
| ENV-007 | Replay all 39 migrations in an empty QA schema | PASS | [Log](evidence/ENV-007-migrations.log) |
| ENV-008 | Recovery startup fails closed instead of using production | PASS | [Log](evidence/ENV-008-startup.log) |
| ENV-009 | Prisma singleton/cache regression | PASS | [Log](evidence/ENV-009-prisma-cache.log) |

The build portion of `npm run build` was executed directly through the installed Next CLI. It did not run the package script's preceding `prisma generate` step. No dependencies were installed or upgraded. Initial PowerShell `npm` invocation encountered execution policy; installed CLIs were invoked through Node instead.

Production is missing **`20261027000100_company_registration_otp`**, which adds `otpHash`, `otpNonce`, and `otpAttempts` to `CompanyRegistration`. All recorded applied checksums matched, allowing LF/CRLF normalization; neither database had unresolved or unknown migrations. This is a confirmed deployment prerequisite, not evidence that a production registration submission was attempted. No migrations were applied to production.

## Functional coverage matrix

| Module | Strongest executed evidence | Remaining limitation |
|---|---|---|
| A. Platform/multi-tenancy | 60 onboarding, 64 routing, 63 staff-session assertions; platform organization pages in browser | Older full account-management suite stops on an invalid employee-session fixture; complete CRUD browser rehearsal remains unproven |
| B. Registration | 61 service and 27 real browser/SMTP/concurrency checks | Protected production migration missing; no real-recipient delivery tested |
| C. Recruitment | Six job action checks; 61 PostgreSQL hiring checks; candidate security and offline readiness tests | Job-edit data loss confirmed; full hiring browser suite timed out during login; actual public application-to-offer browser journey incomplete |
| D. Employee/ESS | ESS activation/ownership/read-model suite; Teaching/Non-Teaching conversion | Legacy H1/H2 fixtures fail current prerequisites; complete employee-profile/history editing browser journey incomplete |
| E. RFID/attendance | Domain tests, 39 attendance assertions, 65 RFID service assertions; 21 browser workflow assertions | Revoked HR cookie remains after kiosk authorization; physical reader not tested |
| F. Leave | 103 assertions including balance ledger, approval/rejection/cancellation and attendance projection | Browser submit/approve/reverse flow not completed |
| G. Payroll | Historical generation, deductions, allocation, review/finalization, immutable entries, ESS visibility | Current-date rules expired; accounting sign-off and full browser payroll rehearsal still required |
| H. Exit | Final-pay and ESS resignation services, financial immutability and access checks | Standalone H10 suite stops after 35 checks on a test import error; full clearance-to-separation browser journey incomplete |

Detailed test IDs, execution failures, blocked dependencies, and untested scenarios are in [TEST-RESULTS.md](TEST-RESULTS.md). Confirmed findings and recommended regression work are in [BUGS.md](BUGS.md).

## Independent statutory expectations

For a synthetic private-sector employee with separately reviewed monthly agency bases of PHP 35,000, the September 2026 sample produced:

| Item | Independently calculated expectation | Actual |
|---|---:|---:|
| SSS employee | 1,750.00 | 1,750.00 |
| SSS employer, excluding EC | 3,500.00 | 3,500.00 |
| Employer-only EC | 30.00 | 30.00 |
| PhilHealth employee/employer | 875.00 / 875.00 | 875.00 / 875.00 |
| Pag-IBIG employee/employer | 200.00 / 200.00 | 200.00 / 200.00 |
| Taxable monthly compensation | 32,175.00 | 32,175.00 |
| Monthly withholding | `(32,175 - 20,833) × 15% = 1,701.30` | 1,701.30 |
| Monthly net, no other deductions | 30,473.70 | 30,473.70 |
| Semi-monthly table sample on 16,087.50 taxable | `(16,087.50 - 10,417) × 15%`, rounded = 850.58 | 850.58 |

Expectations were checked against the [SSS official contribution table](https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf), [PhilHealth premium advisory](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf), [PhilHealth premium circular](https://www.philhealth.gov.ph/circulars/2020/circ2020-0005.pdf), [Pag-IBIG Circular 460 filed at NARO](https://naro.law.upd.edu.ph/storage/01JQWKTTA92H57M9EWV31W8F1D.pdf), and [BIR Annex E](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf). The [government's 2026 PhilHealth announcement](https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/) was also consulted. These sample checks are not a complete legal/rule-change audit through the defense date.

The application's verified statutory month ends at **2026-10**; BIR payment-date coverage ends **2026-10-22**. Actual November agency calls returned `UNVERIFIED_SCHEDULE`. Actual BIR calls for October 23/31 and November 2/15 returned `UNVERIFIED_RULES`. Guard behavior passed; those payroll dates remain blocked. No verified-through constant was extended. See [independent checks](evidence/statutory-independent.json).

## Security findings

No exploitable cross-tenant security exposure was confirmed in the executed scope. QA-BUG-004 meets the requested **P0 data-loss category**, with loss limited to synthetic structured job requirements in the reproduced failed edit; no production loss was observed. This is not a security certification or evidence that every endpoint is safe.

Executed checks rejected hostile/forwarded hosts, forged or expired routing context, cross-tenant sessions and document access, cross-employee ESS records, insufficient roles, expired/revoked staff sessions, copied JWTs after logout, and replayed candidate proofs. Platform and tenant sessions remained separate. Registration throttling, five-attempt OTP exhaustion, one-time verification, cross-device password proof, and secret-free delivery failure handling were exercised. Actual browser HTTP requests rejected a company session copied onto SAGA.

Database assertions covered tenant-linked payroll inputs and allocation constraints, immutable financial/audit data, attendance idempotency, and leave reversal uniqueness. Expected rejected database writes appear in passing test logs; they are not automatically defects.

The final RFID browser run confirmed an HR cookie remains after kiosk authorization, although its server-side token is revoked. Scan entry, lost-confirmation retry using the same UUID, invalid cards, mobile kiosk, origin/tenant rejection, and HR/ESS attendance visibility passed independently. This is a cookie-clearing defect, not demonstrated retained HR authorization. See QA-BUG-005.

No exhaustive penetration test, dependency-vulnerability scan, production TLS/header audit, distributed rate-limit load test, or full endpoint-by-role matrix was completed. Production environment values, OAuth sender authorization, Blob permissions, and AI credentials were not validated by making live external calls.

## Recommendations

1. Review the missing production OTP migration and intended deployed SHA before any production-based registration demonstration; apply only through a separately approved release.
2. Independently reverify statutory and tax coverage through the intended payroll date, then review the coverage update and regressions. Preserve every safeguard. Until then, use a clearly disclosed September 2026 synthetic example.
3. Make job edits validate before mutation and commit requirement replacement and job update atomically. Regress the observed failed-edit case before permitting live editing in the defense.
4. Repair the lint gate and stale test fixtures without weakening legal, hiring, or statutory prerequisites.
5. Test the three newer careers UI commits on the exact intended defense revision.
6. Conduct a full human/browser rehearsal of the remaining workflows and physical RFID equipment; assign a backup recording and static synthetic payslip/screenshots.

No fixes or deployment actions in this list were performed during QA.

# WorkPulse test results

Date: 2026-11-02 Asia/Singapore. Tested SHA: `cfcbd8512edbc3e74148e2541ed03bc9f37ec3cd`. Environment, revision caveats, and statutory sources: [REPORT.md](REPORT.md).

## How to interpret results

**PASS** means the stated check executed with supporting evidence. **FAIL** means an executed assertion/check failed; it does not by itself establish an application defect. **BLOCKED** means a required setup/dependency prevented the workflow. **NOT TESTED** means no adequate execution was completed. A passing service test is not a browser end-to-end pass.

The [execution index](evidence/execution-index.json) contains suite commands, exit codes, timestamps, and schema identifiers. Individual `.log` files retain actual stdout/stderr. Earlier runner failures and failing legacy suites are retained below; they are not silently counted as passes. Assertion counts refer to each suite's own unit and may overlap. No combined assertion total is used.

## Environment and code gates

| ID | Test | Result | Evidence |
|---|---|---|---|
| ENV-001 | Local HEAD, recent history, initial tree, remote main comparison | PASS, with newer-remote limitation | REPORT revision table; `origin/main=c820c52`, tested `cfcbd85` |
| ENV-002-prisma | Installed Prisma schema validation | PASS | [Log](evidence/ENV-002-prisma.log) |
| ENV-003-typescript | Full TypeScript no-emit check | PASS | [Result](evidence/ENV-003-typescript.json) |
| ENV-004-lint | Repository lint excluding new QA-only scripts | **FAIL**, 100 errors/61 warnings | [Log](evidence/ENV-004-lint.log) |
| ENV-005-build | Optimized Next production build, webpack | PASS | [Log](evidence/ENV-005-build.log) |
| ENV-006-P | Live protected-production identity/history/checksums, read-only | **FAIL deployment prerequisite**, one pending migration | [Metadata](evidence/database-protected.json) |
| ENV-006-D | Live development identity/history/checksums, read-only | PASS, 39 applied, no pending/checksum mismatch | [Metadata](evidence/database-development.json) |
| ENV-007 | All repository migrations into an empty QA schema | PASS, 39 migrations | [Log](evidence/ENV-007-migrations.log) |
| ENV-008-startup | Startup recovery verification and fail-closed behavior | PASS | [Log](evidence/ENV-008-startup.log) |
| ENV-009-prisma-cache | Current-model Prisma singleton/cache handling | PASS | [Log](evidence/ENV-009-prisma-cache.log) |
| ENV-011-preservation | Environment hashes and tracked source preservation | PASS at final evidence capture | [Execution index](evidence/execution-index.json) |
| ENV-012-cleanup | Remove only ownership-manifest schemas on verified development branch | PASS, 32 QA schemas removed | [Evidence](evidence/cleanup.json) |
| ENV-013-reports | Required reports, local evidence links, configured-secret scan | PASS, four reports; no missing links or configured-secret matches | [Validation](evidence/deliverable-validation.json) |

`ENV-005` ran the build CLI directly, not the package script's `prisma generate && ...` wrapper. The existing generated client was used successfully by compilation and database-backed tests. Deployment environment and deployed code revision were not inferred from this build.

## A. Platform administration and tenants

| ID | Scenario | Result / actual scope | Evidence |
|---|---|---|---|
| ADM-002-onboarding | Organization validation/initialization, HR invitation, activation, resend/revoke and role isolation | PASS, 60 assertions | [Log](evidence/ADM-002-onboarding.log) |
| ADM-002-C | Idempotent creation, competing slugs, initialization rollback, activation/revocation races | PASS, included in the 60 | Same log, real PostgreSQL operations |
| ADM-003-clean | Entire older platform admin/account suite | **FAIL**, stops on `StaffCredentialsChanged` for employee fixture | [Log](evidence/ADM-003-clean.log); stale fixture explanation in BUGS |
| ADM-004-login | Platform login and separate server-side logout mechanism | PASS, explicitly in SEC-003 checks 53–54 | [Log](evidence/SEC-003-staff-production.log) |
| ADM-005-browser | Self-registered organization appears in platform list/detail; manual creation page opens | PASS, browser checks within REG-004 | [Checks](evidence/legacy/docs/company-registration-otp/browser-tests.json) |
| SEC-001-routing | Host parsing, signed tenant routing, path/subdomain compatibility, forwarded-host attacks and foreign workspace sessions | PASS, 64 assertions | [Log](evidence/SEC-001-routing.log) |
| SEC-003-staff-production | Login budgets; session attributes; copied-token logout; password/role/account changes; expired/malformed tokens; platform/candidate/kiosk separation | PASS, 63 assertions | [Log](evidence/SEC-003-staff-production.log) |
| ADM-006-browser | Complete platform-account create/edit/disable/password browser cycle | NOT TESTED completely | Only the above service/partial-account evidence is established |

## B. Registration and verification

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| REG-005-rollback | Service suite with actual database and request header/cookie adapters | PASS, 61 assertions, outer transaction rolled back | [Log](evidence/REG-005-rollback.log) |
| REG-005-OTP | Six-digit format; hashed/verifier storage; correct, wrong, expired, consumed, resent and exhausted codes | PASS within service suite | Same log |
| REG-005-device | Another browser requires registration password; cross-device verification; resend proof | PASS | Same log |
| REG-005-legacy | Pending legacy link completes; resend invalidates old link and converts record to OTP | PASS | Same log |
| REG-005-delivery | Delivery failure creates no active user; no secret-bearing preview; persistent email flood limits | PASS using controlled sender/no-delivery modes | Same log |
| REG-004-browser | Public registration → loopback SMTP → cross-device resend/verify → tenant login → branding → dashboard refresh | PASS, actual production-build browser; 27 total checks including related security/races | [Browser checks](evidence/legacy/docs/company-registration-otp/browser-tests.json) |
| REG-004-concurrency | Duplicate registration, five concurrent failed attempts, cross-browser exhaustion, concurrent valid verification | PASS, independently committed database races | Same checks and [log](evidence/REG-004-browser.log) |
| REG-004-mobile | Registration/OTP fit 390px; OTP also fits 320px; paste/focus and visibility controls | PASS, browser | Same checks |
| REG-006-production | Registration against protected production | **BLOCKED and intentionally not submitted** | Missing migration; no production writes allowed |
| REG-007-mail | Delivery to actual recipient/provider mailbox | NOT TESTED; intentionally prohibited | Loopback synthetic sink only |

## C. Recruitment and hiring

| ID | Scenario | Result / actual scope | Evidence |
|---|---|---|---|
| REC-004-01 through -06 | Actual job Server Actions: draft creation, publish, valid edit, foreign-job denial/preservation, close | PASS, six checks | [Log](evidence/REC-004-job-actions.log) |
| REC-004-07 | Failed edit preserves structured requirements | **FAIL**, one requirement becomes zero after invalid date rejects | [Evidence](evidence/job-atomicity.json), QA-BUG-004 |
| REC-002-hiring | Institution/generic, Teaching/Non-Teaching readiness, interviews/exam prerequisites, onboarding review, employee conversion and authorization | PASS, 61 PostgreSQL checks | [Log](evidence/REC-002-hiring.log) |
| REC-002-races | Duplicate/different stage changes, repeated submissions, duplicate conversion, rejection/conversion contention, task reopening | PASS, actual concurrent PostgreSQL commits | Same log; [results](evidence/legacy/docs/hiring-final-verification-2026-10-27/postgres-results.json) |
| REC-005-security-prod | Candidate proof/session ownership, revoked/expired/reused link, anonymous portal/upload denial, neutral duplicate receipt | PASS, controlled in-memory dependencies, no email/database | [Log](evidence/REC-005-security-prod.log) |
| REC-006-functional | Current readiness, transitions, checklist preservation, rollback and simulated races | PASS, 63 offline groups; **simulated**, not additional database concurrency proof | [Log](evidence/REC-006-functional.log) |
| REC-001-extraction | Normalization, quality scoring, parsed-resume schema coercion, unsupported MIME handling | PASS, offline | [Log](evidence/REC-001-extraction.log) |
| REC-007-browser | Full existing recruitment browser suite | **BLOCKED after executed failure**, `NORMAL_LOGIN_TIMEOUT` in its transaction-backed fixture setup | [Log](evidence/REC-007-browser.log); not counted as a browser workflow pass |
| REC-008-apply | Real public careers Apply → applicant submission → applicant email verification → document upload | NOT TESTED end-to-end | Candidate security is covered separately; no actual public-submission browser journey completed |
| REC-009-AI | External AI parsing of actual PDF/DOCX resume | BLOCKED by deliberately disabled external integration | Text/schema tests do not establish AI extraction success |
| REC-010-offer | Candidate completes real browser offer acceptance and onboarding submission | NOT TESTED end-to-end | Accepted-offer fixtures/readiness checks are not proof of the acceptance UI |
| REC-011-latest-ui | Careers/apply rendering on remote `c820c52` | NOT TESTED | Three newer styling commits were inspected only |

## D. Employees and ESS

| ID | Scenario | Result / limitation | Evidence |
|---|---|---|---|
| ESS-001-service | Invitations/activation, expiry/rotation/single use, account linkage, profile/dashboard, confidential-field exclusions, own attendance/leave/payroll reads | PASS | [Log](evidence/ESS-001-service.log) |
| ESS-001-boundaries | Same-tenant different employee, different tenant, inactive/disabled accounts, malformed ownership, staff/employee separation | PASS | Same log |
| EMP-001-core | Older complete employee conversion/profile suite | FAIL, fixture rejected by current `NOT_READY` prerequisites | [Log](evidence/EMP-001-core.log) |
| EMP-002-probation | Older teaching/non-teaching lifecycle suite | FAIL, generic renewal fixture needs `LEGAL_REVIEW_REQUIRED` evidence | [Log](evidence/EMP-002-probation.log) |
| EMP-003-categories | Current Teaching and Non-Teaching conversion readiness/records | PASS through REC-002 | Does not certify all profile/history editing controls |
| EMP-004-browser | Complete employee invitation email → browser activation → own profile/history workflow | NOT TESTED end-to-end | Service activation and access restrictions executed |

## E. RFID, attendance and schedules

| ID | Scenario | Result / actual scope | Evidence |
|---|---|---|---|
| ATT-001-domain | Exact lateness/undertime/grace, monthly tardiness aggregation, payroll evidence invalidation/readiness | PASS, 20 checks | [Log](evidence/ATT-001-domain.log) |
| ATT-003-clean | Schedule assignment/overlap, Time In/Out, duplicate/conflicting references, correction concurrency and immutable events | PASS, 39 assertions in separate clean schema | [Log](evidence/ATT-003-clean.log) |
| RFID-002-clean | Leading zeroes/input validation, enrollment/replacement/deactivation, kiosk authorization, invalid cards, repeated scans, scopes and permission revocation | PASS, 65 assertions | [Log](evidence/RFID-002-clean.log) |
| RFID-003-browser | Actual HR card enrollment, replacement, deactivation and fresh enrollment | PASS for first three assertions; full run FAIL/BLOCKED at production HTTP-origin mismatch | [Log](evidence/RFID-003-browser.log) |
| RFID-004/005 | Initial local HTTPS attempts | FAIL during harness setup/trust/debug-port issues; not product defects | [004 log](evidence/RFID-004-https-browser.log), [005 log](evidence/RFID-005-https-isolated.log) |
| RFID-006-trusted-https | Trusted local HTTPS, kiosk cookie-removal assertion | **FAIL** at cookie assertion after enrollment; Node certificate trust resolved | [Log](evidence/RFID-006-trusted-https.log) |
| RFID-008-cookie | Browser HR-cookie removal after kiosk authorization | **FAIL**, revoked HR cookie remains; QA-BUG-005 | [Metadata only](evidence/kiosk-cookie.json) |
| RFID-008-scans | Keyboard scan with/without Enter, lost confirmation and same-UUID retry, unknown/inactive cards, mobile kiosk, origin/session/tenant rejection, HR and ESS synchronization, prefixed workspace routes | **PASS, 21 browser assertions**; overall suite still **FAIL/exit 1** for the separate cookie issue | [Log](evidence/RFID-008-cookie-and-scans.log), [scan evidence](evidence/legacy/docs/rfid/verification/scan-confirmation-event.json) |
| RFID-007-hardware | Physical USB reader, actual card types, reader suffix/timing, target kiosk equipment | **NOT TESTED — human hardware check required** | Software simulation cannot establish physical-reader compatibility |

## F. Leave

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| LEA-002-clean | Policies/types, balance configuration/projection, employee requests, HR approval/rejection/cancellation, ledger reversal and attendance integration | PASS, 103 assertions | [Log](evidence/LEA-002-clean.log) |
| LEA-002-boundaries | Foreign tenant/employee checks, unsupported states, duplicate reversal/immutable ledger protections | PASS, within 103 | Expected constraint rejections are in passing log |
| LEA-003-browser | Employee browser request → HR decision → employee balance/attendance refresh | NOT TESTED as one browser journey | HR empty pages rendered in UX-005; service integration passed |

## G. Payroll and statutory calculations

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| PAY-001-statutory | SSS bracket boundaries, EC/MPF, PhilHealth floor/ceiling/rounding, Pag-IBIG, reviewed exemptions and unsupported history | PASS, 93 tests | [Log](evidence/PAY-001-statutory.log) |
| PAY-002-bir | Monthly/semi-monthly brackets, benefits/effectivity, deduction classification, incomplete/exceptional input rejection | PASS, 56 tests | [Log](evidence/PAY-002-bir.log) |
| PAY-004-workflow | Empty-period review rejection, draft deletion, standard setup, verified opening history, reuse, effective-date/current-date readiness | PASS, 24 assertions | [Log](evidence/PAY-004-workflow.log) |
| PAY-005-integration | Compensation/setup, monthly/semi-monthly generation, attendance/deductions, review/finalize, contribution reservations and races | PASS, 56 assertions | [Log](evidence/PAY-005-integration.log) |
| PAY-006-phase3 | Current supported inputs, revised monthly bases, second-cutoff reconciliation, scoped allocation guards and foreign-key ownership | PASS, 15 assertions | [Log](evidence/PAY-006-phase3.log) |
| PAY-007-presentation | Finalized payslip model, breakdown, employer/employee separation, historical snapshot consistency, finalized lock/read behavior | PASS, 28 assertions | [Log](evidence/PAY-007-presentation.log) |
| PAY-008-independent | Published-rule PHP 35,000 historical examples, monthly/semi-monthly table samples | PASS | [Independent evidence](evidence/statutory-independent.json) |
| PAY-009-current | Actual November contributions and BIR October 23/31, November 2/15 pay dates | **BLOCKED for generation; PASS fail-closed safeguards** | `UNVERIFIED_SCHEDULE` / `UNVERIFIED_RULES`, QA-BUG-001 |
| PAY-003-foundation | Entire legacy payroll foundation suite | FAIL after 18 checks on generation expectation; not a substitute for current suites | [Log](evidence/PAY-003-foundation.log) |
| PAY-010-production | Generate/finalize production payroll | **NOT TESTED — prohibited** | No production payroll mutations performed |
| PAY-011-browser | Complete browser configuration → generate → review → finalize → ESS payslip | NOT TESTED as one uninterrupted journey | Service/DB tests and actual dashboard rendering completed separately |

## H. Exit management

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| EXIT-001-final-pay | Reviewed draft/calculation, deadlines, approval, frozen amounts, idempotent partial/full payments, overpayment, scopes and immutable records | PASS | [Log](evidence/EXIT-001-final-pay.log) |
| EXIT-002-resignation | Employee notice, duplicate/spoofed submission, HR acknowledgment/review distinction, withdrawal, SAGA policy, post-execution ESS revocation | PASS | [Log](evidence/EXIT-002-resignation.log) |
| EXIT-003-separation | Standalone exit/clearance/lifecycle suite | **FAIL overall** after 35 checks, extensionless dynamic import error | [Log](evidence/EXIT-003-separation.log) |
| EXIT-004-browser | Full browser resignation → clearance → separation → final-pay approval | NOT TESTED | Services executed; empty HR exit page rendered with missing-policy warning |

## UI/UX and security checks

| ID | Scenario | Result | Evidence |
|---|---|---|---|
| UX-001-payroll | Actual payroll-generation component: pending hides stale success, controls disabled, errors/success accessible | PASS, offline render | [Log](evidence/UX-001-payroll.log) |
| UX-002-jobs | Tenant-scoped paging/search/status validation, bounds, deterministic order, empty results and minimal reads | PASS, controlled DB dependency | [Log](evidence/UX-002-jobs.log) |
| UX-004-hiring-adapted | Current pipeline page query gating/scope with controlled dependency/font stub | PASS, offline; original unadapted Node rendering failed on font loader | [Log](evidence/UX-004-hiring-adapted.log) |
| UX-005-layout | 19 HR routes × 1280/390/320 widths | PASS, **57/57**: correct route/main, no captured JS error, no detected rendered error, document width fits | [Matrix](evidence/legacy/docs/company-registration-otp/qa-layout-matrix.json) |
| UX-005-visual | Representative 390px payroll, new-job, exit screenshots visually inspected | PASS for visible portions | [Payroll](evidence/ui-payroll-390.png), [job](evidence/ui-hiring-jobs-new-390.png), [exit](evidence/ui-employees-exit-390.png) |
| UX-006-states | Registration success/error/cooldown; payroll component pending/success/error; actual empty HR pages | PASS for these cases only | Linked registration, payroll and layout evidence |
| UX-007-exhaustive | Every button/form, all modal keyboard paths, screen reader, every loading/network-error state and all populated mobile tables | NOT TESTED exhaustively | 57 layout passes must not be represented as full interaction/a11y coverage |
| SEC-004-HTTP | Actual copied company session on SAGA, public registration on tenant host, verification cache/referrer headers | PASS | REG-004 browser checks |
| SEC-005-exhaustive | Complete hostile endpoint matrix, vulnerability/dependency scan, distributed load/rate limits | NOT TESTED | Current evidence is targeted authorization/concurrency testing |

The 19 actual HR routes were dashboard; jobs/new job; pipeline; interviews; assessments; offers; onboarding; employees; exit; attendance; schedules; RFID; leave; balances; leave settings; payroll; organization; analytics. Most route checks used a newly registered empty organization. Populated long tables, every modal, and ESS mobile pages were not covered by that matrix.

## Retained setup failures and replacements

- `ATT-002` failed when sharing a schema with other suites; `ATT-003-clean` passed in a fresh schema. Earlier search-path trigger failures were runner configuration errors.
- `LEA-001` could not import `server-only`; `LEA-002-clean` passed using a test-only import adapter.
- `REG-001/003` lacked the synthetic SAGA fixture / outer savepoint transaction; `REG-005-rollback` passed using the original suite's transaction contract.
- `REG-002` failed on nested migration setup contention; `REG-004-browser` passed with migration locks retained.
- `REC-003` assumed production cookie attributes while the runner was not production; `REC-005-security-prod` passed in production mode.
- `SEC-002` stopped on secure-cookie attributes in test mode; `SEC-003-staff-production` passed in production mode.
- Initial offline TSX attempts failed before test code because of the restricted process environment. They were rerun successfully with database/external services still disabled.
- Migration `P1002` setup timeouts are not counted as executed functional failures. They are retained in command output/migration logs where captured. Initial logs overwritten by a successful same-ID retry are not presented as separate retained artifacts.

## Final disposition

The release-level assessment remains **NO-GO for a full current-date production demo**, independently of any remaining browser-harness limitations. See [DEMO-READINESS.md](DEMO-READINESS.md) for the restricted demonstration candidate and explicit prerequisites.

The final RFID result is split deliberately: **21 browser workflow assertions passed**, while HR-cookie clearing failed and the overall process returned exit 1. No physical hardware pass is claimed. Cleanup removed the 32 schemas named in this run's ownership manifests, and all original environment-file hashes remained unchanged.

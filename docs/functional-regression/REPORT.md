# WORKPULSE — COMPREHENSIVE FUNCTIONAL REGRESSION REPORT

Testing completed October 21, 2026 (Asia/Singapore), following the October 20 performance sprint.

**Recommendation: HOLD MERGE.** FR-01 and FR-02 remain fixed and retested. The candidate-document review corrected tenant, file-state and response-content gaps, but confirmed two unresolved high-severity ownership risks: ID-only private access and unverified shared Applicant identity updates. The final runs passed 66 document assertions, 71 Profile security scenarios and 45 browser workflows; these do not cancel the open exposure probes. See [the candidate-document review and permission matrix](candidate-documents/REPORT.md). Candidate-document authorization is not secure across all identified paths.

## 1. Features and workflows tested

### Environment and review

- Used the verified `workpulse-batch0-recovery` Neon endpoint throughout. No production connection, push, merge or deployment.
- Reviewed `docs/performance-audit/final-ux/REPORT.md`, its outstanding limitations, the current optimization diff, frozen pre-optimization read models, prior Batch 1–3 changes/reports and implemented routes/services.
- Review covered selective Profile reads; Dashboard aggregates/employee alerts; Hiring read ordering; request-scoped auth/tenant/branding reuse; ESS/leave aggregate previews; Analytics; payroll review/generation inputs; attendance materialization/retries; and payroll processing feedback.
- Adapted testing to implemented features: Profile supports employment lifecycle actions and ESS account management. An arbitrary personal-information edit/save form is not implemented on the inspected Profile page, so no such feature is claimed as tested.
- Existing schema-changing runners and seed-account mutation scripts were not run directly. No schema, migration, trigger, index or constraint was created, changed or disabled.

### Automated coverage

| Suite | Result | Scope and limits |
|---|---|---|
| H4/H7 ESS integration | PASS | Seven logged groups covering profile/employment, own attendance/leave/payroll, account activation, token/account restrictions, persisted roles, disabled/inactive employees, ownership and forged identifiers. Original rollback fixture. |
| H5 Leave | PASS, 103 assertions | Requests, validation/eligibility, overlap restrictions, approvals/rejections/cancellation, ledger reversals, balances, attendance integration, notification failure handling with injected delivery functions, tenant isolation and legacy balance equivalence. Original rollback fixture. |
| H6 Payroll/ESS payslips | PASS, 69 assertions | Compensation/effective dates, monthly/daily calculations, policy/deductions, leave treatments, setup failures, review/finalization restrictions, immutable finalized entries, historical snapshots, ESS visibility and foreign ownership denial. Original rollback fixture. |
| H8 Analytics/Dashboard | PASS, 48 assertions after correction | Populated statistics, categories/date filters, timezone/DST boundaries, current/historical employment, currencies, role/tenant forgery, no source mutation and complete Dashboard parity for HR Admin, Organization Admin and Hiring Manager. |
| Adversarial Dashboard boundary | FAIL before correction; PASS after | Fourteen employees inserted in reverse identifier order; compares complete legacy/current view models, ten-row category membership/order and all three back-office roles. |
| H1 Employee Core, adapted | PASS, 22 existing assertions plus Profile parity | Conversion prerequisites, employee relationships, repeat conversion and exact complete/six-tab profile payloads including badge counts and tenant denial. Serialized rollback adapter; concurrent commits are not verified. |
| H2 Employment/Probation, adapted | PASS, 24 existing assertions plus Profile parity | Regularization, Teaching renewal/non-renewal rules, historical/inactive records, effective dates, decisions and Profile data. Serialized rollback adapter. |
| H3 Attendance, adapted | PASS, 39 fixture assertions | Timezone/DST, pairing, lateness/undertime/statuses, schedules, duplicate event references, correction versions, immutable evidence, tenant rejection and event/projection rollback. Concurrent-looking calls execute serially in this adapter; they are not concurrency evidence. |
| H10.1 Exit/Clearance, adapted | PASS, 84 assertions | Role/tenant denial, notice policy, clearance, reviews, optimistic versions, immutable audit writes/deletes, readiness, cancellation, pagination, historical preservation and audit-write failure rollback. TRUNCATE assertion excluded. Trigger-based fault injection replaced by client-side audit-write failure injection. |
| H10.2 Final Separation, adapted | PASS, 57 assertions | Approval/execution gates, effective dates, final state, account disabling, old invitation denial, history preservation, repeat execution, backdating, inactive employee exit and audit-write failure recovery. Genuine two-transaction attendance-writer/exit lock race excluded. |
| S1 SaaS shell | PASS | Tenant host/path parsing, navigation prefixes, active-section/child routes, branding validation and color helpers. |
| Extraction units | PASS | Text normalization, quality classification, parsed-resume schema validation and unsupported file type handling. No live AI call. |
| Runtime startup | PASS, five checks | Verified recovery selection, refusal of unsafe/missing profiles and original authentication/startup settings. |
| Targeted Hiring read regression | PASS | Parallel unfiltered reads; valid, blank and foreign job filters; tenant predicates. Uses controlled read dependencies. |
| Targeted payroll form state | PASS | Pending, returned success/error/setup messages, stale-success replacement and disabled duplicate-submission controls. Uses controlled action state. |

The adapted H1/H2/H3/H10 tests execute the existing fixture assertions against real PostgreSQL. Their source is transpiled in memory; cleanup/bootstrap is replaced by an enclosing rollback and nested transactions use serialized savepoints. Legacy source files are not edited on disk for this adaptation. H10 reuses the existing SAGA organization as read-only policy context and creates only new fixture records. **The unmodified native H1/H2/H3/H10 runners were not certified as passing in their normal independent-transaction/private-schema mode.**

Evidence: `test-*.json`, `adapted-*.json`, `dashboard-boundary-initial.json`, `dashboard-boundary.json` and the corresponding execution artifacts.

### Browser coverage

Used headless Chrome, the compiled production application and real password login/Server Actions. Forty-four scenarios passed in the full browser run. The server is a test-only custom server; all synthetic tenants, users, employees and writes are enclosed in one rollback transaction, with a read-only fallback datasource. This preserves real rendering, validation, authorization and database calculations, but does not reproduce production transaction commits or concurrency.

Verified beyond HTTP status/render success:

- Profile identity and effective employment; all six tabs; populated Compliance task; Account email, activation and audit data.
- Invalid employment effective date: visible validation, zero decision rows; corrected submission: exactly one regularization decision and a new effective-dated employment record, with the old record retained. Decisions tab includes the persisted actor.
- Missing employee: not-found state; subsequent valid Profile navigation recovers.
- Hiring pipeline excludes foreign jobs. Owned and foreign job filters retain expected behavior.
- Application APPLIED → SCREENING through the actual stage dialog: persisted status and exactly one matching history row.
- Job edit/save: persisted title; reloaded pipeline reflects the edited title and current candidate.
- Payroll actual request: pending status and disabled selector/button before completion; persisted gross/net amounts both exactly `35000.00` for the valid fixture employee; missing compensation for the second employee is reported; repeat submission retains one entry.
- Attendance, Leave, Analytics, Exit Management, jobs and applicant detail routes render the fixture workflows.
- Normal employee login and own ESS Profile, Employment, Attendance, Leave and Payroll pages; another fixture employee's name absent from own Profile.
- Hiring Manager navigation hides employee/payroll modules; direct Profile URL redirects.
- Cross-tenant Dashboard request with the authenticated cookie is denied without the fixture employee identity in the response.
- Unauthenticated Dashboard request redirects to login; wrong password creates no session; correct retry logs in successfully.

**The original stale-role negative test failed.** The focused security follow-up has now corrected it: 71 security scenarios and 45 browser workflows pass on the final build. Original failure evidence is retained; see the follow-up report.

Evidence: `browser-scenarios.json`, `browser-result.json`, `role-browser-scenarios.json`, `stale-role-profile.json`, `browser-conditions.json` and `browser-cleanup.json`.

## 2. Passed, failed and unexecuted scenarios

### Passed

The automated rows marked PASS and the 44 browser scenarios above. The final corrected Dashboard matches the frozen implementation for populated fixtures and for adversarial selection beyond the ten-record limit. Original balances, payroll calculations and stored histories pass the exercised comparisons.

### Failed application scenarios

1. **Dashboard bounded preview selection/order — corrected.** Initially failed the HR Admin complete-model comparison; the fourteen-employee test then reproduced differing preview members for HR Admin and Organization Admin despite matching counts. Post-correction full parity and boundary tests pass.
2. **Revoked HR permission with a stale admin JWT on Employee Profile — fixed and retested.** The original 307 response leaked employee identity. The security follow-up now denies all six tabs in HTML/RSC without protected data or protected employee delegate calls.

### Not executed or not established

| Gap | Reason and implication |
|---|---|
| Genuine concurrent commits, locks, serialization retries and generation/finalization races | No existing disposable namespace was available, and creating/migrating schemas was prohibited. Savepoint serialization cannot validate these behaviors. Prior performance-batch evidence is historical, not a fresh pass. |
| Native H10 TRUNCATE rejection | Deliberately excluded; no TRUNCATE was issued against recovery data. |
| Database-trigger installation for fault injection | Prohibited DDL; client-side audit-write failure tested instead. Actual existing immutable-write triggers were still exercised. |
| Complete interview, assessment, offer approval/signature and candidate document-submission browser journeys | Not executed as complete browser write workflows. H1 readiness/conversion and populated Profile tests exercise related prerequisite records, but do not establish these full UI journeys. |
| Live email, AI resume parsing, hosted document/blob storage and external delivery | No live messages or third-party side effects performed. Injected notification success/failure and local extraction units are narrower coverage. |
| Older seed-dependent recruitment scripts | Inspection found reads/writes against named seeded users/applications, including candidate onboarding submission scripts. Not run against existing user records or followed by seeding. |
| Directory filter/pagination, every Dashboard interactive control, arbitrary personal-info editing and every account-management browser action | Not fully exercised as browser workflows in this session. Arbitrary personal-info editing is absent from the inspected Profile interface. Backend/profile coverage is not a substitute for all UI paths. |
| Pre-optimization HTTP behavior for stale-role disclosure | Follow-up completed: an isolated production build of unchanged commit ea1fc23 reproduces the same disclosure. The problem predates the final UX sprint; origin before earlier batches remains unestablished. |
| All browsers, mobile layouts, accessibility audit, load/soak testing and production/Vercel | Not part of the executed evidence. |

Initial fixture/harness failures were not counted as application regressions: wrong fixture enum/required fields, uppercase synthetic login address, native-dialog selector mismatch, and legacy DDL-dependent fixture sections. They were corrected or explicitly excluded before the applicable successful runs. Initial Dashboard failure evidence is retained separately. The original stale-role application failure is retained as historical evidence; the focused security follow-up fixes it and passes its negative response-body tests.

## 3. Confirmed issues, reproduction and corrections

### FR-01 — Dashboard preview membership changes at the row bound

**Severity:** Medium. **Attribution:** confirmed final performance-sprint regression. **Status:** fixed and retested.

Reproduction:

1. Create fourteen isolated ACTIVE employees with no compensation/account; give each an employment department. Insert in descending identifier order.
2. Render the frozen pre-sprint Dashboard and optimized Dashboard for the same tenant/date and HR Admin or Organization Admin role.
3. Compare the two ten-row employee alert categories. Counts match, but the original optimized SQL selected different preview members and order.

Root cause: Prisma's prior bounded employee reads implicitly added ascending employee-ID ordering. The replacement parameterized SQL used `LIMIT 10` without that ordering. PostgreSQL's physical/plan order therefore affected both membership and presentation. This also explains why smaller fixture runs could pass intermittently.

Minimal correction in `src/features/dashboard/employee-alerts.ts`: restore ascending employee ID before each category limit and order the combined result by category/ID. Limits, eligibility, role checks, latest-department rule and metric formulas are unchanged.

Coverage: `scripts/test-functional-dashboard-boundary.cjs` verifies complete view-model equality, membership and order beyond ten employees, plus Hiring Manager visibility. The 48-assertion populated H8 suite also passes afterward.

### FR-02 — Profile data present in redirect body after persisted role downgrade

**Severity:** High. **Status:** fixed and retested. **Attribution:** reproduced on the unchanged pre-final-UX commit, so not introduced by the final UX sprint.

The original reproduction logged in normally as an Organization Admin, retained its JWT, downgraded the persisted fixture role to Hiring Manager and fetched Profile without following redirects. The 307 body contained employee identity. The isolated unchanged-commit build reproduces that same failure.

Root cause: JWT claims were treated as current permissions in the child page while persisted-role rejection occurred only in its parent layout. Independent layout/page rendering allowed employee data into the redirect payload. Request caching and a forged signature were not responsible.

The focused correction validates current persisted membership at the shared session boundary and performs Profile's tenant-aware authorization before its employee read. Related document handlers also guard current staff permissions before reads, reject invalid staff-cookie fallback and return successful files with no-store caching.

**Executed follow-up:** 71 security scenarios, including 12 stale-token Profile HTML/RSC responses with zero tested sensitive fields and zero protected employee delegate calls; a real denied lifecycle Server Action POST with zero writes; and 45 complete browser scenarios. TypeScript, ESLint, Prisma validation, production build and integrity checks pass. No schema, calculation service or original user-data change was made.

Full reproduction, policy, exact files, results, limitations and remaining risks: [Profile authorization security follow-up](profile-security/REPORT.md). Original failure artifacts remain historical evidence. New authoritative results are under profile-security/.

## 4. Database integrity and safety verification

Final result in `integrity-summary.json`:

- **50 tables checked across every current column; zero row-count/fingerprint differences.** This includes H10 tables and later-added columns, rather than only the older 46-table projection.
- Only the existing public schema remains; namespace/table counts unchanged.
- Column, constraint, index and enabled-trigger catalog fingerprint unchanged.
- Migration history unchanged: 23 history records, 22 successfully applied/non-rolled-back entries. The extra historical record is the pre-existing H5 workflow migration entry; no migration command was executed.
- Original `.env` SHA-256 unchanged.
- Browser fixture organizations remaining: zero. All browser/service fixtures rolled back; no existing user data reset or deletion. No schema or audit trigger was disabled for cleanup.
- Production was not selected. No push, merge or deployment was performed. Owned test servers were closed.

The failed authorization probe also rolled back its temporary user's role change and all associated fixture records. No live mail or external document upload was sent.

Build/verification:

| Check | Result |
|---|---|
| TypeScript | PASS |
| Prisma validation | PASS; validation only, no schema write |
| Production build after Dashboard correction | PASS, 63,471 ms |
| ESLint on QA-changed/new code and corrected helper | PASS |
| `git diff --check` | PASS |

During the initial QA session, the only application-source correction was Dashboard ordering. The later focused security follow-up changes the shared session/guard, Profile gate and three document handlers, as listed in its report. Prior optimization and UI work remains present. Attendance/payroll calculation logic was not edited.

## 5. Remaining performance limitations

No additional optimization or performance benchmark was undertaken. The prior report remains the timing source:

- Development compilation/framework overhead remains substantial.
- Development Dashboard completion had mixed/regressed timing despite reduced SQL; no new latency improvement claimed here.
- Hiring browser and HTTP timings were mixed.
- Attendance's historical nine employee-day workload was approximately 8.5 seconds.
- Historical payroll generation was approximately 1.5/11.8/27.1 seconds for 5/50/100 employees. Processing is still sequential and long-running at scale.
- Large histories/boards, contention, high concurrency, deployment-region latency and production/Vercel behavior remain uncharacterized by this functional session.

The real payroll pending indicator, persisted completion result and repeat-submission behavior passed for the small fixture. That is not a large-workload throughput or concurrency guarantee.

## 6. Outstanding risks

1. **High, open:** candidate portal/data actions, downloads and uploads accept matching IDs without verified candidate ownership; public reapplication can also update a shared Applicant across organizations using an unverified email. These were reproduced with isolated fixtures. Candidate identity/credential lifetime and shared-identity update policy decisions remain required. FR-02 itself remains resolved.
2. **Concurrency/commit coverage:** serialized savepoint fixtures cannot certify independent-transaction races, retry deadlines or actual post-commit behavior. A native rerun in an approved disposable database is still required.
3. **Recruitment/external workflows:** full interview/assessment/offer/candidate document journeys and real external services remain unverified end to end.
4. **Test harness scope:** the rollback server intentionally differs from ordinary `next start` transaction ownership. Its results establish tested rendering/action/data behavior, not production concurrency or transaction timing.
5. **Bounded-query maintenance:** new raw SQL projections must continue matching Prisma ordering, tenant predicates and required fields as schemas/UI evolve. The new boundary test guards the confirmed failure mode.

## 7. Merge recommendation

**Do not merge yet.** FR-01 and FR-02 are corrected and retested. The scoped document restrictions, regression suites and build checks pass, with no original data or schema changes. Verified candidate ownership and the unverified shared-identity update must be resolved before accepting the branch's security posture. Native concurrent-transaction and remaining external workflow coverage also remain outstanding.

See [the focused security follow-up](profile-security/REPORT.md) for confirmed root cause, actual pre-sprint HTTP comparison, exact modified files, all security/functional results, session-policy limits, navigation/performance effect and evidence. No merge, push, deployment, new feature or additional optimization was performed.

## 8. Candidate-document authorization review

Full path inventory, exact modified files, reproductions, permissions, results and policy decisions: [Candidate document authorization review](candidate-documents/REPORT.md).

Access paths include public application resume upload; candidate portal HTML and metadata; its exported data action; recruitment/onboarding upload actions; staff initialization, upload and review/sync actions; private resume parsing; three download/preview handlers; same-origin UI links/iframe; and local/private Blob storage. No signed-download URL or document-delete feature was found.

The established permission matrix is organization-scoped:

| Principal | Upload | Preview | Download | Update/replace/review | Delete | After status changes |
|---|---|---|---|---|---|---|
| Organization Admin / HR Admin | Recruitment and onboarding | All three file categories | All three | Recruitment and onboarding; existing transitions retained | No feature | Existing staff access retained; reads tested in all nine statuses |
| Hiring Manager | Recruitment requirements | All three | All three | Recruitment only; no onboarding mutation | No feature | Existing staff read access retained |
| Employee | No staff upload | No staff preview | No staff download | No staff mutation | No feature | No staff document grant |
| New public applicant | Initial resume for published/open job | No original-resume grant | No original-resume grant | No original-resume replacement feature | No feature | Initial submission only |
| Candidate portal user | Intended own requirements and DOCUMENT tasks | Intended own files | Intended own files | Not verified/waived; now checked server-side | No feature | Hired onboarding exists; credential lifetime and terminal-state retention undecided |
| Other candidate | No intended grant | No intended grant | No intended grant | No intended grant | No feature | Current ID-only mechanism cannot securely distinguish ownership |

Same-organization staff access is not restricted to assigned jobs/candidates in the implemented RBAC. A candidate is not an implemented Prisma user role, and the portal has no independent identity proof. Matching IDs are relationship validation, not proof of ownership.

Implemented corrections: current staff/request-tenant guards for document mutations and parsing; tenant-host checks for candidate portal/actions/downloads, including rejection of unprovisioned hosts; server enforcement of the portal's existing verified/waived/non-document restrictions with conditional writes; supported extension/MIME validation; safe attachment handling for active legacy content; no-store/nosniff headers; and generic missing-storage 404 responses.

Executed: **66 passing document guard/functional assertions**, including real multipart Server Actions and browser replacement/download; **four deleted/orphan/missing-file scenarios**; **71 existing Profile security scenarios**; **45 final-build browser workflows**; existing H1 recruitment integration (22 assertions plus Profile parity), ESS/Dashboard/Hiring/startup regressions; private SDK/handler contract tests; TypeScript, ESLint, Prisma validation, production build and diff check. Six independently recorded exposure findings remain open rather than counted as successful authorization restrictions.

The final integrity comparison matches all 50 application tables, catalog, namespaces, migration history and original `.env`; fixture cleanup reports zero remaining fixture organizations. No push, merge, deployment, existing-data deletion, schema change, attendance/payroll logic change or additional optimization occurred.

**Exact unresolved decisions:** application-bound candidate identity proof; grant lifetime/renewal/revocation and legacy URL treatment; access after rejection/withdrawal/completed onboarding; and email ownership verification before an existing shared Applicant can be changed by a reapplication. The question was raised during the session; no response established this policy. Candidate access was not redesigned or disabled on a guessed policy. Live hosted asset ACLs, email recovery and independently committed races remain unverified. Nine existing original resumes lack an application association and remain inaccessible rather than receiving guessed ownership.

**Merge remains blocked by CD-01 and CD-05.** Establish and implement the ownership policy across every identified path, then convert the exposure probes into denial tests. Passing the scoped guards and FR-02 regressions is not a complete candidate-document security sign-off.

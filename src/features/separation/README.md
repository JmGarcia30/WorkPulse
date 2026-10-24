# Separation backend: H10.1 and H10.2

Use `service.ts` from server code. It reads the authenticated back-office session
and request tenant through the existing guard. The internal `core.ts` factory is
for trusted dependency injection and integration testing; never expose its context
resolver, database instance, or actor identifiers through an action or request.
The minimal HR interface is under `/dashboard/employees/exit` (including tenant
prefixes such as `/saga`). Its Server Action independently authorizes the actor
and delegates all decisions to this service. Phase 3 adds eligible employee
submission/tracking at `/employee/resignation` through its own ESS guard, sharing
the same case creation primitive and lifecycle. Final execution requires an explicit confirmation checkbox, remarks,
and the latest case version; backend readiness and date checks remain mandatory.
Employee search returns at most 20 tenant-scoped identities. Case lists support
bounded pagination, employee search and status filtering.

## Operating and verifying the HR interface

Use Employees → Exit Management. Create a draft, then open **Edit case / start
processing** and save the details to start processing. Record actual clearance
decisions and review evidence, resolve the displayed blockers, mark ready, and
approve. Future approvals preserve employment and ESS access until HR explicitly
executes the case on or after the effective date. Execution requires remarks and
confirmation of employment closure and ESS termination. Reload after a version
conflict; do not overwrite another reviewer's decision.

Both H10 migrations must be applied before the configured application schema can
serve these pages. Confirm the target is development/test before deployment; never
reset a database or change migration history. `npx tsx scripts/check-h10-readiness.ts`
performs read-only migration/catalog inspection and prints no connection secrets.

Run `npm run build` followed by `npm run test:h10-interface` to exercise the actual
rendered HTML forms and Server Actions against a local production server. The
test replays migrations in a randomly named disposable schema, signs fixture
sessions, checks authorization and complete/future/cancelled workflows, stops its
server, and drops only that schema. It does not provide visual browser testing.

The service checks the actor's current database role and tenant on every operation,
including reads. Only Organization Admin and HR Admin are authorized. Input
schemas reject unknown keys, including organization IDs, actors, timestamps and
readiness flags. Errors have a safe `SeparationError.code` and message.

## Case workflow

`DRAFT -> IN_PROGRESS -> READY_FOR_FINAL_REVIEW -> APPROVED_PENDING_EFFECTIVE -> COMPLETED`

Every state before completion can transition to `CANCELLED` with a reason.
For an employee-submitted notice, cancellation additionally requires explicit
confirmation and evidence of the employee's withdrawal; it is not an HR rejection.
Cancellation is terminal; readiness freezes further case/checklist edits. A new
case after cancellation requires a new request key. Draft, readiness and approval
operations never change employee status. Only explicit H10.2 execution does. Already
separated employees cannot receive new active cases; inactive employees require
an explicit administrative exit justification.

Create requests require `requestKey`. Identical requests by the same actor return
the original case; reusing a key with different data conflicts. All subsequent
mutations require `caseId` and `expectedVersion` from the latest read. Metadata
updates accept the full `details` or `item` object, rather than an unchecked patch.
Use `updateSeparationCase({ caseId, expectedVersion, details, status: 'IN_PROGRESS' })`
to start a draft. A stale request returns `CONFLICT`; reload before deciding
whether to resubmit. Repeating readiness with the current version is a no-op.

All writers claim the same case version before changing requirements, decisions,
exceptions or reviews. Reads and H10.1 mutations use repeatable-read isolation, have a
15-second timeout, and perform only database operations. A partial unique index
prevents multiple active cases for an employee, including concurrent
requests with different keys. The partial index and database triggers are custom
SQL in the new migration and must be retained in later migrations.

## Notice and policy

The policy resolver matches the existing SAGA organization slug `st-aloysius`.
Each case stores its policy snapshot. SAGA resignation uses one calendar month,
with month-end clamping and date-only `YYYY-MM-DD` input / PostgreSQL `DATE`
storage. It never substitutes 30 days or converts notice dates through time zones.
Other tenants receive `POLICY_REQUIRED` until their HR Administrator configures
their notice policy in Organization settings → Resignation Notice Policy
(`/dashboard/settings/exit`). Policies support calendar days or calendar months
and an explicit choice to allow authorized short-notice exceptions. They do not
inherit SAGA notice or superior/HRMO review requirements. SAGA settings are fixed.
Only the current persisted `HR_ADMIN` role can save settings; organization admins
may inspect them. Tenant and actor identity always come from the existing guard.

Each new case captures the current policy. Settings changes do not rewrite
configured, approved, completed or cancelled case snapshots. An editable legacy
case with an unconfigured policy can capture the newly configured policy by
saving its case details; the existing case audit records old/new snapshots and
the details revision invalidates old reviews and exceptions as before.
Missing-policy guidance appears on the case, creation and listing screens.

Phase 1 adds only nullable `Organization.resignationPolicy`; it does not backfill
existing organizations. `node scripts/exit-policy-recovery.cjs apply` verifies the
recovery target, applies only this migration and compares existing record
fingerprints. `node scripts/test-exit-organization-policy.cjs` runs focused tests
on that verified target with mandatory fixture rollback and preservation checks.
After `node scripts/exit-policy-checks.cjs build`, run
`node scripts/test-exit-policy-interface.cjs` for rendered production HTML and
real HTTP Server Action checks, also using rollback fixtures. This is not visual
browser coverage. `exit-policy-checks.cjs` also supports `generate`, `types`, and
`lint`; all modes load only the verified recovery environment.

Short notice is `EXCEPTION_REQUIRED`. `recordNoticeException` requires an explicit
reason and authorized actor, and records the actor, server time and audit event.
Changing case details invalidates prior exceptions and review evidence. The
original exception and reviews remain in immutable history.

`recordSeparationReview` records verified documentary evidence or a reference
provided by authorized HR/Admin. SAGA requires both `NOTICE_SUPERIOR` and
`NOTICE_HRMO`. The recorder is the actual authenticated user; it is not an
electronic signature by the superior or HRMO. No review is generated by default.
Termination cases require separately recorded administrative review, supporting
documentation and due-process evidence before readiness; no dismissal or legal
determination is performed.

## Clearance and readiness

The baseline resolver explicitly creates five pending required categories:
HR records, property, IT, finance, and turnover. Category codes and responsible
units are extensible strings. Tenant-specific defaults can be added in the resolver
without introducing policy UI; the snapshot records required categories per case.

Only `recordClearanceDecision` changes decision status. Explicit verification is
required for cleared, blocked and waived decisions. Blockers and waivers require
remarks. Pending items have no reviewer or review timestamp. Editing a requirement
resets it to pending and records the previous decision in the audit.

Readiness requires an in-progress case, mandatory dates and explanation, every
policy-required category present as required, all required items verifiably
cleared/waived, valid notice/exception information, and applicable verified review
evidence for the current case details revision. Optional items do not block it.
The backend calculates blockers and never accepts a client readiness flag.

## Reads and historical protection

Organization and employee listings accept bounded pagination (default 25, maximum
100) with stable date/ID ordering and tenant-scoped totals from one transaction
snapshot. Case details include the checklist, reviews, readiness and audit history.
Audit history also has a paginated read. Employee summary supplies an active-case
flag, linkable case ID, status and clearance progress for future profile work.
DTO dates are ISO strings; employee identity excludes salary, contact information
and other unrelated confidential data.

Audits and verified review records reject database updates, deletes and truncation.
Case mutations and their audits commit together; audit timestamps are set by a
database trigger. Restrictive composite foreign keys enforce tenant consistency
and protect retention. H10.1 operations do not write employee status,
employment/probation, ESS, schedules, attendance, leave, payroll, or hiring records.

## H10.2 final approval and execution

`approveSeparationCase` requires the current case version, an explicit
`decision: 'APPROVE_SEPARATION'`, and mandatory remarks. It only accepts a ready
case, rechecks current clearance and documentary review evidence, and records the
authenticated approver and server time. Approved details remain frozen. Approval
never disables an account or changes employment status, including approval for
today or a historical date. HR must explicitly call `executeSeparation`.

Execution requires the current version and mandatory remarks, then revalidates
readiness, approval and effective-date eligibility. The institution's configured
timezone determines today's date from server time. The effective date is the
first day outside employment; the proposed last working day must precede it.
The last working day must also belong to a recorded employment interval. An
inactive employee's later formal exit does not invent a new last working day
after their already recorded H2 employment closure.
Employment uses H1/H2's exclusive end convention and UTC-encoded calendar dates,
not a conversion of local midnight into an employment timestamp.

Backdated approvals require `backdatedJustification`. Delayed execution after the
effective day requires that justification either from approval or execution.
Recorded work/finalized attendance at or after the local effective boundary,
future employment, multiple open employment records, and conflicting already
closed employment intervals require administrative date review. Closed historical
employment dates are never rewritten. Payroll overlaps are financial follow-up
items; they are not extra institutional clearance blockers.

One transaction claims the case, changes ACTIVE/explicitly authorized INACTIVE
to SEPARATED, appends status history, closes the open employment record, closes
unresolved probation, disables any linked account, invalidates invitations,
appends all relevant audits, and completes the case with a snapshot. The account
helper accepts the existing transaction and performs no nested transaction or
external I/O. A downstream failure rolls everything back. Repeating execution of
a completed case returns its saved result. Concurrent execution cannot create
duplicate histories. Completed cases reject database updates and deletion.

Execution uses READ COMMITTED after claiming the case and employee row. Boundary
checks therefore see work committed by a writer that held the employee lock
first; they cannot rely on an older transaction snapshot. New-work guards lock
the same employee row, while the case version protects clearance and approval.

Probation closure has a separate `closedBySeparationCaseId`: it retains the
unresolved `PENDING` H2 decision and null H2 decision metadata, while setting the
probation state to CLOSED and recording an H10 audit. Existing H2 non-renewal,
regularization and renewal decisions remain unchanged. INACTIVE alone does not
create or complete an exit.

JWT signatures and cookies are not cryptographically revoked by a database
update. Every protected ESS page/query, leave action/document download and
employee payslip path checks current database eligibility through the existing
ESS guard or its equivalent. A previously signed JWT fails eligibility once
the employee is separated/account disabled. Activation now also checks current
employee status; transactional leave withdrawal/document removal rechecks
eligibility rather than relying on a previously resolved ESS context.

Database guards serialize new active-employee work against the employee row.
Separated employees cannot receive new employment/schedule assignments, active
compensation, account activation, new leave or leave documents, or post-boundary
attendance/payroll transactions. Historical payroll settlement before the boundary
and authorized historical maintenance remain possible. No automatic changes are
made to schedules, attendance, leave ledgers, payroll snapshots or hiring history.

New reads are `getPendingFinalApprovals`, `getApprovedSeparations`,
`getCompletedSeparations`, and `getFinalPayReadiness`; existing employee history
and audit reads include completed cases. Listings retain bounded pagination and
tenant-scoped snapshot totals. Profile summaries exclude completed/cancelled
cases from the active-case flag.

Final pay readiness reports clearance, outstanding accountabilities, unresolved
payroll entries/periods, finalized payroll overlaps, and relevant pending,
overlapping or failed-sync leave. It returns FOLLOW_UP_REQUIRED or
READY_FOR_FINANCE_REVIEW independently of separation. Calculation/payment states
now reflect the separate Phase 2 final-pay record when present; without one they
remain NOT_CALCULATED / NOT_RECORDED. Payroll finalization never proves payment.

## Phase 2: Final Pay Management

The existing Exit case detail page includes a final-pay panel. Current HR_ADMIN
users can create one draft per case, save explicit reviewed inputs, record HR
review, approve/finalize the itemized PHP settlement, and record actual partial or
full payments. Organization Admins retain read access. All service operations use
the existing tenant/session/role guard and transaction boundary.

The panel reuses recorded payroll, compensation, attendance, leave and employment
data as evidence. It does not infer payment from payroll status or convert all
leave balances automatically. Missing/unsupported inputs block review and leave
totals undetermined. Salary, 13th-month and leave calculations use payroll Decimal
infrastructure; separation pay, additions/refunds and lawful deductions require
externally verified amounts and detailed legal/contractual evidence. Qualified
tax/statutory review and prior-payment reconciliation are explicit requirements.

Final approval requires a completed separation and current reviewed sources.
Changing case details or financial source records requires reconciliation and
renewed review. Approval freezes amounts and source evidence in an immutable
record. It does not block separation, delay ESS termination or restore access.
Payments are append-only receipts, not bank transfers; outstanding and payment
status derive from approved net less recorded receipts. Request keys, unique
references and a parent-row lock prevent duplicate/overpaid receipts.

Organization settings also support a more favorable final-pay deadline (0–30
calendar days), audited separately from notice policy. Individual cases can
shorten it further. The clock starts at effective separation, not clearance or
execution. Favorable deadlines cannot be extended; outstanding balances retain
overdue tracking. Applicable 13th-month December 24 timing is displayed for
separate review, including prior-payment/partial-payment allocation.

`20261024000400_employee_final_pay` adds only a nullable organization policy field
and three new tables. Its custom restrictive tenant FKs, unique indexes and
history/payment validation triggers must be retained in later migrations.
`node scripts/final-pay-recovery.cjs apply` applies only that migration on the
verified recovery target and compares pre-existing data fingerprints.
`npm run test:final-pay` uses rollback fixtures. After a recovery build,
`npm run test:final-pay-interface` exercises rendered HTML and real Server Actions.
See `docs/final-pay/legal-basis.md` for authoritative sources, supported inputs
and explicitly unsupported calculations/corrections.

There is no scheduler. HR uses the existing Exit Management interface and Server
Actions for explicit approval and execution. Rehire/reactivation is outside
H10.2 and is not enabled by completion.

## Integration tests

### Phase 3: Employee resignation through ESS

Active employees with a current active ESS account and recorded employment can
submit a reason, proposed last working day and effective date. The server records
the notice date in the organization timezone. Required fields/calendar dates,
employment interval and last-day/exclusive-effective ordering are validated.
Missing notice policy or short notice does not prevent lodging the notice; the
existing HR policy, exception, documentary-review and readiness rules remain in
force during processing. SAGA's calendar month and both reviews are preserved.

`ess-resignation-service.ts` derives session/tenant identity on the server. Its
internal factory rechecks the actual user, account, employee and organization in
the transaction, sharing employee/account/user row locks with eligibility changes.
Employees cannot submit another employee/tenant ID, choose a notice date, forge
HR review, edit the lodged notice, or read HR audits/legal notes/final-pay data.
One active case per employee and actor-scoped request-key replay protect against
duplicate notices, including alongside HR-managed exit cases.

The existing dashboard **Requires Attention** queue provides durable in-app HR
notification from unacknowledged ESS cases (bounded to 15 per tenant view). This
reuses the current queue rather than introducing a second notification inbox,
email sender or parallel resignation lifecycle. HR sees each notice in the
existing Exit list/detail page and can record a receipt message visible to the
employee. Acknowledgment does not change case state, satisfy either SAGA review,
clear clearance items, grant permission to resign, change access, or create final
pay. It is not a prerequisite for administrative readiness/approval/execution.

The original notice and submitted reason/dates are preserved by a snapshot and
database checks/triggers. HR can add processing remarks, resolve initially missing
policy, record applicable exceptions/reviews, and use the existing lifecycle.
Corrections/withdrawal require coordination with HR; this phase does not expose
employee editing/withdrawal actions. A verified employee withdrawal can be recorded
through the existing HR cancellation action, retaining its evidence in audit.

Employee tracking exposes only their own ESS notices, status, receipt message,
notice compliance and clearance counts, with bounded pagination. Internal HR
remarks, review evidence, audit history and finance details remain private. Only
normal explicit execution revokes ESS; afterward HR retains the same case and
Phase 2 final-pay management. No access change or financial calculation occurs on
submission or acknowledgment.

`20261024000500_ess_resignation_notice` adds provenance/receipt metadata, a scoped
FK/index and protection constraints/triggers to the existing case table. It adds
no second notice/case table. Apply only through the verified recovery helper:
`node scripts/ess-resignation-recovery.cjs apply`. Run
`npm run test:ess-resignation`, and after a recovery build,
`npm run test:ess-resignation-interface`. Both use rollback fixtures and record
preservation evidence under `docs/ess-resignation/`. See the implementation report
there for exact manual steps and coverage limits.

`npm run test:h10-1` creates a cryptographically random `h10_test_*` schema,
applies historical migrations unchanged plus H10.1, and removes only that schema
in `finally`. `H10_TEST_DATABASE_URL` can select a dedicated test database;
otherwise the configured connection is used solely to create the temporary
schema. The connection needs schema creation privileges. Neon tests use its
direct endpoint and an explicit search path for existing trigger functions.

`npm run test:h10-1 -- --regressions-only` runs `test:h1`, `test:h2`, `test:h4`,
`test:h5`, `test:h6`, and `test:s1` through npm in another temporary schema.
Neither mode deploys H10.1 to the existing application schema.

`npm run test:h10-2` replays both migrations in a fresh `h102_test_*` schema and
tests finalization, rollback, concurrency, dates, old-JWT rejection, invitations,
H2 preservation and financial follow-up. Its internal clock injection is only a
trusted factory dependency for boundary tests; the server service always uses
server time and never accepts a browser clock. `--regressions-only` runs H10.1,
H1, H2, H4, H5, H6 and S1 through npm in isolated schemas. A failed suite can be
rerun individually with `--regression=test:h5` (or another listed script).

Only the temporary-schema migration subprocess disables Prisma's database-wide
advisory lock: each invocation exclusively owns a different random schema. It
does not unlock or terminate another database session, change application
configuration, or disable locking for application deployments. See
[Prisma's advisory-lock documentation](https://docs.prisma.io/docs/orm/v6/prisma-migrate/workflows/development-and-production)
and [Neon's Prisma connection guidance](https://neon.com/docs/guides/prisma).

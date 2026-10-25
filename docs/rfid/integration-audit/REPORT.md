# RFID → Schedule → Attendance → Payroll audit

Scope: `employee-ui-design`, Neon `workpulse-ess-design` development only.
Started with the read-only audit in `read-only-before.json`. No business rates,
employee attendance records, existing schedules, migrations, recovery settings,
production resources or production backups were changed.

## Read-only SAGA findings

- Organization timezone: **Asia/Manila**.
- Four active employees, one active card and two committed RFID events at audit
  start. Those punches belong to the same employee/day and the same daily record.
- The October 25, 2026 scans are **Sunday / REST_DAY**, correctly using the assigned
  schedule. Local Time In is **14:55:58.813** and Time Out **14:57:05.212**. Their
  recorded grace is 900 seconds, but Sunday has no scheduled start/end, so late
  and undertime are null. The implementation does not invent a weekday shift or
  mark these punches absent. See `current-rfid-projection.json`.
- Existing schedule versions have both **900-second** and **zero** grace. The
  assignment's immutable version determines which grace is used.
- SAGA has **no active compensation records**, **no OrganizationPayrollPolicy rows**, **no reviewed statutory inputs**
  and **no opening-tax history**. Default company attendance deduction rules are
  `NONE`. This is not proof of approval for any nonzero deduction rate.
- The policy model records active status, effective dates, version and authorized
  creator. It has no separate finance-approval signature/state. Business approval
  cannot be inferred merely from `ACTIVE`; obtain and retain that approval before
  operational use. No approval workflow or live policy was invented in this audit.

## What works

The isolated full-chain test uses the actual RFID adapter, PostgreSQL transactions,
card lookup, direction/idempotency rules, assigned schedule version, daily
materializer, reviewed statutory setup and payroll generator. Historical scenarios
use a test-only proxy for the database clock; production has no client clock override.

The copied SAGA schedule is 08:00–17:00 on weekdays, with an unpaid 12:00–13:00
break and 15-minute grace. Expected results:

| Scenario | Expected daily result |
| --- | --- |
| 08:00 → 17:00 | Present; 0 late; 0 undertime; 8 worked hours |
| 08:15 → 17:00, 15-minute grace | Present; 0 late; 7h45m worked |
| 08:20 → 16:30, 15-minute grace | Present; 5 late minutes; 30 undertime minutes; 7h10m worked |
| 08:16 → 17:00, 15-minute grace | 1 late minute |
| 08:20 with zero grace | 20 late minutes |
| No punches before scheduled end | Open, not prematurely absent |
| No punches after scheduled end | Absent on a workday |
| Weekend without a workday | Rest Day, not absent |
| Duplicate UUID or rapid repeat | Original event/repeat feedback; no extra Time In or direction switch |
| No schedule | Retain RFID evidence; No Schedule; no invented late/absence duration |

Grace currently subtracts its configured seconds from elapsed lateness; a punch
one second beyond the 15-minute boundary has one late second. Payroll retains
seconds and converts them to minutes only under a configured per-minute rule.
This documents the existing semantics, not a new HR rule. Alternative grace or
paid-break deduction interpretations need explicit business policy approval.

Absences require attendance evaluation after shift end; an employee who never
scans does not generate an RFID event. HR must evaluate/refresh the period before
attendance-based payroll. Overtime seconds are evidence and do not create an
automatic monetary overtime entitlement.

## Focused defects and corrections

The original full-chain regression produced **five failed assertions** identifying
three actual defects. See `scenarios-before-fix.json` and `chain-before-fix.json`.

1. **Habitual tardiness was counted across the selected period.** Two September
   plus two October late days incorrectly triggered the flag. The summary now
   checks **four late occurrences in one calendar month**. The period total remains
   available; the HR indicator label now states the monthly scope. This is an HR
   review indicator, not an automatic deduction or disciplinary action.
2. **Attendance-based payroll accepted unresolved days.** A full row count did
   not establish that Open, Incomplete or partial No Schedule days were resolved.
   Such policies now return `SETUP_REQUIRED` for incomplete coverage or unresolved
   attendance. Fixed monthly pay with all company attendance rules `NONE` retains
   its existing behavior; no unapproved deduction is introduced.
3. **Review could finalize stale attendance deductions.** A correction after
   generation could change absence inputs while review still accepted the old
   calculation. New attendance-based snapshots carry a canonical fingerprint of
   the exact consumed daily inputs. Review detects changes, and finalization locks
   the consumed rows through the final check/commit. Finalized historical snapshots
   remain untouched. Existing unfinalized snapshots lacking evidence require
   explicit review; they are not silently rewritten.

Fingerprint inputs are local attendance date, status, leave disposition, late
seconds and undertime seconds—the values consumed by this payroll calculation.
Query ordering and recalculation timestamps do not cause false changes.

The audit also reproduced a Prisma `P2028` transaction expiration during attendance
recalculation on Neon. The shared serializable attendance transaction now has a
bounded 30-second execution timeout and 10-second acquisition wait, consistent
with the RFID adapter's existing 30-second bound. Only serialization conflicts
are retried; arbitrary failures/timeouts are not silently replayed.

## Policy and payroll checks

- No SAGA late, undertime, absence or habitual-tardiness rate was supplied or
  created. With no company policy, all company attendance rules remain `NONE`.
  This does not imply zero statutory contributions or tax.
- The rate-free absence fixture explicitly creates an authorized synthetic policy
  selecting the existing `DAILY_RATE_PER_ABSENT_DAY` option. It derives a daily
  amount from the existing synthetic compensation helper and scheduled workdays;
  it does not invent a fixed monetary deduction parameter or apply it to SAGA.
- The fixture month has 30 daily records, 22 scheduled weekdays, six present days,
  16 absent workdays and four late occurrences totaling 660 seconds (11 minutes).
  Payroll must consume those exact totals. Late/undertime rules are `NONE`, so
  they charge zero despite measured lateness/undertime and the four-occurrence flag.
- A missing monetary parameter fails validation. Missing reviewed statutory bases,
  coverage or opening history must return setup requirements, not guessed values.
- A schedule gap for one day is tested even when the remainder of the month is
  configured; other monetary validation must not mask the schedule gap.

## Previously reported payroll fixture failures

The older Batch 3 comparison and H6 foundation suites retain outdated assumptions:

- They do not provide reviewed statutory inputs and opening-tax history now
  required by `calculateIntegratedPayroll`.
- They expect daily-pay arrangements to generate through an integration that
  currently supports fixed monthly salary with monthly/semi-monthly payment.
- The Batch 3 reference calculation predates statutory ledgers/snapshots and treats
  incomplete attendance as an eligible fixture input. Equality to that reference
  is no longer the active acceptance contract.

Those failures are not evidence that missing data should be bypassed, that
statutory deductions should be zeroed, or that invented rates should be used.
The old suites are retained as diagnostics, rather than changing production
calculation to make legacy expectations pass. The current payroll integration
suite supplies reviewed inputs and tests the active contract.

## Files changed by this audit

- `src/features/attendance/domain.ts` and HR employee attendance detail label:
  calendar-month habitual-tardiness review.
- `src/features/attendance/service.ts`: bounded Neon attendance transaction timeout.
- `src/features/payroll/attendance-evidence.ts`: input readiness and canonical evidence.
- `src/features/payroll/service.ts`: reject unresolved financial attendance and
  snapshot the consumed evidence.
- `src/features/payroll/review.ts`: reject stale evidence and stabilize rows for
  finalization.
- `scripts/audit-rfid-payroll-readonly.cjs`: pinned read-only state/fingerprint audit.
- `scripts/test-rfid-schedule-payroll.ts`: complete isolated integration scenarios.
- `scripts/test-attendance-payroll-rules.ts`: boundary/evidence regression tests.
- `scripts/rfid-development.cjs`: isolated audit modes and preserved diagnostics.

## Validation and preview decision

Final results:

| Validation | Result |
| --- | --- |
| Full RFID → assigned schedule → daily attendance → payroll | **42 assertions passed** |
| Month/grace boundaries and payroll evidence regression | **20 assertions passed** |
| Existing H3 attendance foundation | **39 assertions passed** |
| Current statutory payroll integration | **55 assertions passed** |
| TypeScript `tsc --noEmit` | Passed |
| Focused ESLint for all audit source/test files | Passed |
| Local Next.js production build, read-only development datasource | Passed; 49 static pages generated |
| Before/after public-record fingerprints | **All eight protected tables unchanged** |
| Older Batch 3 and H6 foundation fixtures | Fail under outdated setup/expectations described above |

The full-chain scenarios initially failed five assertions, now zero. Tests used
new disposable schemas on the pinned Neon development branch; only those newly
created fixture schemas were dropped. No existing records were changed. There
was no migration change, database reset, environment/recovery edit, production
access, push or deployment. Evidence is in `scenarios.json`, `rules-regression.json`,
`preservation.json`, and `../verification/{h3-regression,current-payroll-integration,build}.json`.

**Ready for controlled Vercel preview integration testing with isolated fixtures;
not ready for SAGA operational payroll.** The actual Vercel deployment, hardware
reader, browser focus behavior and preview-network latency were not tested here.
On preview, verify scanner Enter termination, retained leading zeroes, automatic
focus restoration, Asia/Manila display, same-scan retry after network interruption,
rapid repeat protection, tenant rejection, and HR attendance visibility using a
designated test employee. Do not use real employee attendance as fixture data.

Regardless of automated test results, SAGA operational payroll needs approved
business settings and reviewed statutory/opening inputs. A generated snapshot
that becomes stale requires a defined approved recalculation/adjustment workflow;
this audit adds a safety block and does not delete/rewrite reserved payroll entries.
Daily-pay statutory integration and overnight/multiple-pair RFID shifts remain
outside the current supported contract. No push or deployment is authorized here.

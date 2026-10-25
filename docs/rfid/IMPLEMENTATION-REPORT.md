# WorkPulse RFID Attendance Phase 1 implementation

Implemented on `employee-ui-design` for the Neon **development** branch
`workpulse-ess-design`. No push or deployment was performed.

## Delivered behavior

- HR Admin and Organization Admin can search employees, scan/enroll a card,
  atomically replace it, and deactivate it. Leading zeroes are preserved.
  Tenant-scoped HMAC digests replace raw stored card IDs. Partial database indexes
  prevent duplicate active cards and multiple active cards on one employee.
- An eight-hour, revocable kiosk session supports USB keyboard input with Enter
  or without a suffix. Authorizing kiosk mode removes the browser's HR session.
  The standalone screen shows the identified employee, Time In/Out, local date,
  and exact seconds, then clears personal information after ten seconds.
- The database clock determines event time and the 60-second cooldown. First scan
  records Time In, the next eligible scan records Time Out, and further same-day
  pairs are blocked. Ambiguous/corrected sequences require HR review. Overnight
  and multiple break pairs remain outside the existing same-day schedule model.
- Events use `AttendanceSource.RFID` and the shared attendance writer, schedule,
  leave, duration and daily-record projection. HR Attendance and ESS consume those
  same existing records. Manual/import entry remains protected from RFID bypass.
- Concurrent scans, replacements and deactivations use transaction locks.
  Durable UUID receipts make accepted scans and cooldown responses idempotent,
  including retries after a later Time Out. Failed network confirmation preserves
  the request in memory for **Retry Same Scan** before another card is accepted.
- Persisted rate limits, strict payload validation, same-origin checks, current
  HR-role checks, tenant-scoped kiosk lookup and immutable audit records protect
  ingestion. Neither card IDs nor kiosk tokens are stored raw in database evidence.

Open **Attendance → RFID Cards & Kiosk**. The routes are
`/dashboard/attendance/rfid` and `/attendance-kiosk`, with `/saga` prefixes for
the existing single-host/Vercel tenancy flow.

## Changed files

| Files | Change |
| --- | --- |
| `prisma/schema.prisma` | Four RFID models and their relations |
| `prisma/migrations/20261025000100_rfid_attendance_phase1/migration.sql` | Additive tables, tenant constraints, partial indexes and immutable audit triggers |
| `src/features/attendance/service.ts` | Extract shared transaction writer; serialize recording/corrections per employee; database-time projection for RFID |
| `src/features/attendance/rfid-policy.ts` | Strict input schemas and safe direction/cooldown rules |
| `src/features/attendance/rfid-service.ts` | Enrollment, replacement, kiosk authorization, throttling, receipts and ingestion adapter |
| `src/features/attendance/rfid-server.ts` | Existing HR/tenant session integration and sanitized errors |
| `src/features/attendance/rfid-actions.ts` | Authorized enrollment/search/deactivation Server Actions |
| `src/components/attendance/RfidEnrollment.tsx` | HR enrollment and kiosk authorization UI |
| `src/components/attendance/RfidKiosk.tsx` | Scanner input, readable confirmations, focus restoration, retry and locking |
| `src/app/(dashboard)/dashboard/attendance/page.tsx` | Entry link for authorized HR users |
| `src/app/(dashboard)/dashboard/attendance/rfid/page.tsx` | HR page and recent scoped audit activity |
| `src/app/attendance-kiosk/page.tsx` | Standalone tenant-themed kiosk and authorization gate |
| `src/app/api/attendance/rfid/scan/route.ts` | Authenticated scan API |
| `src/app/api/attendance/rfid/kiosk/route.ts` | Kiosk authorization and revocation API |
| `src/app/api/attendance/rfid/transport.ts` | Same-origin enforcement, bounded JSON input and no-store responses |
| `src/proxy.ts` | Minimal `/saga` kiosk/API rewrites independent of an HR cookie |
| `scripts/rfid-development.cjs` | Pinned development-only migration and isolated validation runner |
| `scripts/test-rfid-attendance.ts` | Policy, database, security and concurrency integration tests |
| `scripts/test-rfid-browser.cjs` | Real Chrome enrollment and keyboard-scanner workflow tests |
| `docs/rfid/README.md`, `migration-review.json`, `verification/*.json` | Runbook, physical-reader checklist, SQL review and validation evidence |

Pre-existing recovery/environment changes were left untouched. No database
connection, `.env`, recovery script, existing migration, production resource or
production backup was changed.

## Development database changes

Applied **one additive migration**, `20261025000100_rfid_attendance_phase1`.
Development moved from **35 to 36 applied migrations**. New tables:

- `RfidCard`: assignment digests and deactivation history.
- `RfidKioskSession`: hashed tokens, authorizer, expiry and revocation.
- `RfidAudit`: append-only activity and request-id receipts.
- `RfidRequestBudget`: distributed per-actor, per-kiosk and per-organization budgets.

The reviewed SQL checksum is
`5fe381f40eba728cfa2eae03c2b8337cb0c90726a494c07a383a4e200fbccd19`.
Read-only preflight verified the exact development branch/endpoint, applied
checksums and sole pending migration. The retained **development** checkpoint's
recorded history and original-column fingerprints were reverified without
writing to it. It predates the earlier recovery, so recovery from it requires
replaying the eleven previously verified migrations; it is not a new snapshot
of the 35-migration state.

Immediately after applying, fingerprints confirmed **all 68 existing tables were
unchanged**. Tests created new random private schemas, applied the migrations
there and removed only those newly created schemas. No existing database was
reset or recreated. The normal development server was restored on port 3000.

## Validation results

| Validation | Result | Evidence |
| --- | --- | --- |
| RFID policy/service/database/security/concurrency | **PASS: 62 assertions** | `verification/rfid-integration.json` |
| Existing H3 attendance suite | **PASS: 39 assertions** | `verification/h3-regression.json` |
| Current statutory payroll integration, including attendance deductions | **PASS: 55 assertions** | `verification/current-payroll-integration.json` |
| Chrome workflow, desktop/mobile, retry and `/saga` routes | **PASS: 15 assertions** | `verification/browser.json` |
| TypeScript | **PASS** | `verification/typescript.json` |
| Focused ESLint | **PASS** | `verification/focused-lint.json` |
| Local production build, development DB read-only | **PASS** | `verification/build.json` |
| Prisma schema validation/client generation | **PASS** | Schema validation output and `verification/prisma-generate.json` |
| Normal development SAGA login/dashboard/RFID page and kiosk authorization gate | **PASS** | `verification/development-smoke.json` |

These acceptance suites account for **171 assertions**. Chrome verified actual
HR search/enrollment/replacement/deactivation, removal of HR authentication,
Enter/no-Enter keyboard input, exact timestamp display, duplicate handling,
focus after errors, mobile overflow, offline/retry behavior, origin rejection,
missing/copied/revoked kiosk tokens and the `/saga` API rewrite. It reported no
hydration errors or unexpected browser exceptions. A scan-focus race found by
the browser test was corrected by restoring focus after React re-enables input.

The final development smoke check also matched all 51 retained original-column
recovery fingerprints. Public RFID card, kiosk-session and audit tables remained
empty: test fixtures stayed in the disposed private schemas. This final recovery
comparison covers the historical baseline columns; the separate 68-table
comparison in migration evidence covers all existing tables at migration time.

Two additional older payroll diagnostic suites **do not pass**:

- `scripts/test-batch3-services.ts`: legacy snapshot/generation comparison fails
  its first custom-policy parity assertion.
- `scripts/test-h6-payroll-foundation.ts`: passes the first 18 assertions, then
  fails its expectation that legacy fixture employees generate three entries.

Their fixtures predate current mandatory statutory inputs/opening history and
include daily-pay arrangements that the unchanged statutory integration rejects
with setup requirements. The reference calculation also predates current
statutory snapshots. Payroll code and those suites were not changed to hide the
failures. Their actual results remain in `verification/attendance-payroll-regression.json`
and `verification/h6-regression.json`. The current payroll integration suite
provides the passing regression coverage for the active payroll architecture.
The runner retains old suites under `regressions`; its acceptance `test` mode
uses the current suite.

An overlapping migration run hit Prisma's shared migration lock, and one loaded
H3 run hit transaction-start timeout `P2028`; sequential isolated reruns passed.
Expected database-trigger rejection codes such as `P0001` occur in successful
negative security/immutability tests. Local build mode did not deploy anything.

## Hardware and Vercel testing still required

The actual USB reader was **not physically tested**. Use the complete checkbox
list in [README.md](README.md#physical-rfid-reader-checklist-still-required).
At minimum, verify:

1. Exact ten-digit output with leading zeroes, keyboard layout, and actual
   Enter/CR/LF/Tab/no-suffix behavior on the intended kiosk hardware.
2. Real card enrollment, Time In, rapid repeats, Time Out after 60 seconds,
   replacement/deactivation and visibility in HR/ESS.
3. Multiple employees/devices, focus recovery, unplug/reconnect, network loss,
   retry and kiosk locking/expiry.
4. Trusted local-date/time comparison, local-midnight behavior, readable display
   and clearing of employee information.
5. Approved Vercel **testing** deployment: development-only database mapping,
   HTTPS cookies, tenant host or `/saga` routing, region/latency and the same
   stable configured `SESSION_SECRET` for this card registry. Changing that
   HMAC key makes existing cards unresolvable until controlled re-enrollment.

No automatic push, deployment, production migration, recovery reset or hardware
configuration change was performed.

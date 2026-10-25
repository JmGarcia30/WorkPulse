# RFID Attendance Phase 1

Branch: `employee-ui-design`. Development target: `workpulse-ess-design` only.

## Using the module

1. As HR Admin or Organization Admin, open **Attendance → RFID Cards & Kiosk**
   (`/dashboard/attendance/rfid`, or `/saga/dashboard/attendance/rfid` in path tenancy).
2. Search by employee number or name, select an active employee, and scan a card.
   Card numbers are exactly ten ASCII digits and remain strings, including zeroes.
   Enter submits enrollment. One employee can have one active card per workspace.
3. To replace a card, select the employee again and scan the replacement. The old
   assignment is deactivated atomically. **Deactivate Current Card** blocks a lost
   card without assigning another. Assignments and their audit history are retained.
4. On a dedicated device/browser profile, select **Authorize & Open Kiosk**.
   This removes the browser's HR session and issues an opaque, HttpOnly, host-only
   kiosk cookie lasting at most eight hours. Kiosk permission cannot open HR pages.
5. Scan at `/attendance-kiosk` or `/saga/attendance-kiosk`. Readers with an Enter
   suffix submit immediately; ten digits without Enter submit after 180 ms idle.
   Keep the browser tab foregrounded. **Lock Kiosk** revokes the device session.
   Reauthorization requires normal HR login. Revocation/role changes are checked
   against the database, including when a token is copied to another tenant host.

## Attendance rules and integration

- Only the database clock supplies accepted RFID event timestamps. Client time,
  employee IDs, tenant IDs, source, and direction are not accepted in scan input.
- The organization's IANA timezone determines the calendar day. The kiosk displays
  date and exact time (including seconds) in that timezone. Workstation clock skew
  cannot choose event time, cooldown, or server authorization expiry.
- First directed event is **Time In**. A second scan after at least 60 seconds is
  **Time Out**. Rapid scans return the existing event, including across local midnight.
  A completed pair cannot start another pair that day. Corrections, unclassified
  events, and ambiguous/future-dated sequences require HR review.
- Phase 1 supports the existing same-day schedule model. Overnight shifts,
  multiple in/out pairs for breaks, offline ingestion, and card-based account login
  are not implemented. HR can use the existing correction flow for exceptions.
- The adapter calls the shared attendance writer and `materializeAttendanceDay`
  logic in the same transaction. Existing schedules, leave disposition, durations,
  daily records, HR calendar, and employee attendance views use the same evidence.
  Generic manual/import ingestion still refuses the RFID source.
- Employee advisory locks serialize manual/import/RFID recording and corrections.
  Shared enrollment locks prevent a scan racing card deactivation or replacement.
  An accepted event, its projection, and durable scan receipt commit together.
  Display data loads after commit, so a failed confirmation cannot undo attendance.
  Scans allow a 30-second write transaction and a 60-second client request. See
  [the scan confirmation fix](SCAN-CONFIRMATION-FIX.md) for the timeout incident
  and delayed/lost-response retry evidence.

## Security and operation

- No card-writing operation exists. Employee names are never written to physical
  cards. A card identifies an employee only inside a valid tenant-scoped kiosk;
  it is not an authentication credential. Standard USB readers can accept typed
  or cloned IDs, so a supervised/physically secured kiosk remains necessary.
- The existing configured `SESSION_SECRET` (at least 32 characters) keys a
  purpose-separated HMAC-SHA256 over organization and string card ID. Raw card
  IDs are not stored in the database, audit trail, URLs, or browser storage.
  Enrollment/search responses exclude hashes. Scan input is masked and cleared.
- Preview environments sharing this card registry must use the same stable
  hashing secret, currently the existing `SESSION_SECRET`. Changing it makes
  existing card digests unresolvable and requires controlled re-enrollment; do
  not rotate it casually between previews. No environment file was changed.
- Kiosk tokens use 256 random bits; only their SHA-256 hashes are persisted.
  Production cookies use the `__Host-` prefix, Secure, HttpOnly, SameSite Strict,
  `/` path, and no Domain. HTTP APIs require an exact same-origin Origin header.
  Enrollment Server Actions retain Next's origin protections and recheck HR roles.
- Persistent atomic budgets enforce 60 HR operations/minute per actor, 120 scans/
  minute per kiosk, and 600 scans/minute per organization across Vercel instances.
  Unknown/invalid scans consume budgets too. No in-memory rate-limit assumption.
- API JSON is limited to 1 KiB. Schemas reject extra scan fields. Responses use
  `Cache-Control: no-store`; rate limits include `Retry-After: 60`.
- Unknown/inactive cards and rejected inputs produce durable tenant-scoped audits.
  Enrollment, replacement, deactivation, authorization and locking are audited.
  Security rejection logs contain codes only. No raw tokens, connection URLs,
  card numbers or database errors are returned to the browser.
- Kiosk results clear employee information after ten seconds. No employee lists
  are available through the kiosk. A failed/uncertain request blocks another scan
  until **Retry Same Scan** resolves using the same UUID. Do not reload/close the
  tab while resolving an uncertain scan; its pending input lives only in memory.
- `RfidAudit` is append-only and doubles as the durable request-id receipt. Keep
  its records for the required attendance/audit retention period. There is no
  automated retention job in Phase 1. Expired kiosk rows/budgets are not credentials
  and may be archived later under a reviewed retention process.

## Database change and recovery

Migration: `20261025000100_rfid_attendance_phase1`.

| Table | Purpose |
| --- | --- |
| `RfidCard` | Hashed card assignments and deactivation history |
| `RfidKioskSession` | Revocable, expiring kiosk authorization |
| `RfidAudit` | Immutable operational audit and scan idempotency receipts |
| `RfidRequestBudget` | Persistent bounded request budgets |

The migration creates only these four tables, their indexes/constraints and new
audit triggers. Partial unique indexes enforce one active card per employee and
one active assignment per card within an organization. Composite foreign keys
enforce employee/actor tenant membership. No existing table, row, column, enum,
trigger, database connection, recovery script or environment configuration changes.

Before applying, the runner verified the live development branch and endpoint,
35 applied migration checksums, and the single pending reviewed SQL checksum.
It read the retained development checkpoint without writing to it and verified
its recorded history and original-column fingerprints. That checkpoint predates
the previous recovery: recovering the current baseline requires replaying the 11
already-verified migrations. It is not a new snapshot of the 35-migration state.
After applying, all 68 existing table fingerprints matched. Development now has
36 applied migrations. See `migration-review.json` and `verification/`.

Do not roll back by deleting attendance events, resetting a database, or removing
an applied migration. Disable access to the new kiosk and fix forward if needed.
The existing manual attendance flow remains available.

## Validation commands

These commands use the existing verified local development profile without
changing it. The runner refuses the original `.env` endpoint and pins the expected
development branch/endpoint. It redacts command diagnostics and preserves `.env`.

```powershell
node scripts/rfid-development.cjs generate
node scripts/rfid-development.cjs test
node scripts/rfid-development.cjs checks
node scripts/rfid-development.cjs build
```

`test` creates a new random private `batch3_test_*` schema on development, applies
the migrations there, runs RFID/H3/current statutory payroll/browser tests, then removes
only that newly created schema. It never resets/recreates an existing database.
`rfid` and `browser` modes run those focused checks independently.
`current-regressions` runs H3 plus the current payroll integration suite.
`regressions` retains the older H6/Batch 3 payroll comparisons as diagnostics;
their fixtures predate mandatory statutory inputs and currently fail. Those
failures are recorded in the implementation report and were not hidden or fixed
by changing unrelated payroll code. `checks` runs TypeScript and focused lint.
`build` uses
the development connection with read-only transactions and performs no deployment.
Stop the local Next process before browser tests (which need `.next/dev`) or
before regenerating Prisma on Windows if its engine DLL is locked. Run test
runners sequentially because Prisma migrations share a database advisory lock.
Do not change the working recovery startup configuration.

## Physical RFID reader checklist (still required)

- [ ] Use the intended reader, USB port, kiosk operating system and browser.
      Verify its keyboard layout and that a leading-zero card yields exactly ten
      digits; confirm whether the suffix is Enter, CR/LF, Tab, or none.
- [ ] Enroll a real card to a designated development test employee. Scan it on
      the authorized kiosk; confirm the correct name, Time In, local date, and
      exact seconds against a trusted time source.
- [ ] Repeatedly present/hold the card within 60 seconds; verify one event and
      duplicate feedback. Test two devices scanning the same card concurrently.
- [ ] After at least 60 seconds, record Time Out; confirm the same employee/day
      in HR Attendance and ESS. A third scan must not add another pair.
- [ ] Scan multiple employees quickly. Verify focus after success, rejection,
      tapping blank space, changing window focus, and returning from browser UI.
      Scan only when ready; Phase 1 does not queue scans while a request is busy.
- [ ] Check leading-zero cards, partial/extra digits, rapid reader repeats,
      Enter and no-Enter modes, Tab suffix behavior, and reader unplug/reconnect.
- [ ] Test an unknown card, deactivate an enrolled card, and replace a lost
      card. Verify old/inactive cards fail and the replacement succeeds.
- [ ] Disconnect networking mid-scan, reconnect, and use **Retry Same Scan**.
      Verify one event. Confirm the workflow for extended outages (HR correction;
      there is no offline queue or client-supplied backdating).
- [ ] Lock and reopen the kiosk, expire a session, change the authorizing HR
      role, and attempt use from another workspace. Require HR reauthorization.
- [ ] Verify physical screen readability/privacy and narrow-screen layout.
      Confirm employee names clear after ten seconds and raw IDs remain masked.
- [ ] In the approved Vercel **testing** environment, verify HTTPS cookies,
      configured tenant host or `/saga` routing, stable secret, development-only
      database mapping, latency, two kiosks, and local-midnight behavior.
      No Vercel deployment, push, or production migration was performed here.

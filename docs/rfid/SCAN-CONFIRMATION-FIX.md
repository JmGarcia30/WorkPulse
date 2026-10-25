# RFID scan confirmation fix

## Root cause and original scan

Read-only inspection of `workpulse-ess-design` confirmed **H2 Test Non-Teaching**
has one active enrolled card, active employment, SAGA tenant scope, and
`Asia/Manila` timezone. The failed request passed kiosk authorization and card
lookup. It reached the shared attendance writer and attempted to insert the
event, daily record and receipt.

The server then loaded event/employee display data inside that same transaction.
Prisma raised **P2028**: the transaction limit was **15,000 ms**, but **15,654 ms**
had elapsed. The log records **ROLLBACK**. The API returned `503 UNAVAILABLE`,
which the kiosk maps to “Could not confirm this scan…” while retaining its UUID.
The client's own 20-second deadline also left insufficient headroom.

**The original scan was not saved.** Separate database queries found zero
AttendanceEvent records and zero committed scan receipts for this employee.
An INSERT in the query log did not mean COMMIT. The attempted daily projection
rolled back too. See `verification/scan-failure-before.json`.

The kiosk sessions inspected afterward were already locked/revoked. That was not
the original failure, but a locked kiosk needs reauthorization before scanning.

## Focused fix

- `src/features/attendance/rfid-service.ts`: keep event, existing daily projection
  and receipt atomic; load confirmation data **after commit**. Display lookup
  failure can no longer undo accepted attendance. Give only the scan write
  transaction 30 seconds; other RFID operations retain their existing limit.
- `src/components/attendance/RfidKiosk.tsx`: allow 60 seconds for authentication,
  transaction and confirmation. Retain `pending.current`, including its original
  UUID, for uncertain failures and **Retry Same Scan**.
- `src/features/attendance/rfid-server.ts`: serialize safe Prisma error-code
  diagnostics without connection URLs, raw card numbers or kiosk tokens.
- RFID integration/browser tests and their development runner: test delayed/lost
  confirmations, original UUID replay, one event and visibility in attendance.

No shared attendance calculation, migration, environment, recovery configuration,
production resource, existing card assignment or historical record was changed.

## Actual saved-event evidence

The Chrome regression used actual HR search/enrollment, normal HR login, kiosk
authorization, the real scan endpoint and PostgreSQL in a new disposable
development schema. It delayed confirmation past 20 seconds and deliberately lost
the successful response **after commit**. Retry sent the same UUID and recovered
the original result without inserting another attendance event.

| Field | Verified value |
| --- | --- |
| Employee | Synthetic Scanner (isolated fixture, not H2 Test Non-Teaching) |
| Event ID | `cmvnguzoo000vujzw3giqz0e6` |
| Original/retried scan UUID | `6e05d5b0-9007-4f36-8b71-d215af79feb9` |
| Source reference | `rfid:6e05d5b0-9007-4f36-8b71-d215af79feb9` |
| Direction/source | `TIME_IN` / `RFID` |
| Stored instant | `2026-10-25T06:48:20.042Z` |
| Asia/Manila display | October 25, 2026, **2:48:20 PM** |

The test read the committed event/receipt directly from PostgreSQL and verified
the kiosk name/direction/exact time, HR Employee Attendance, Recent RFID Activity,
and employee self-service Attendance. ESS intentionally formats to minutes; kiosk
and HR event details include seconds. The new test schema was disposed afterward;
no fixture was inserted into or removed from the normal SAGA workspace. See
`verification/scan-confirmation-event.json` and `verification/browser.json`.

## Activity and attendance behavior

Successful scans are **intentionally included** in Recent RFID Activity as
`RECORDED`, with the employee and local audit timestamp. Separate rapid scans can
appear as `DUPLICATE_SCAN`. Replaying the same UUID reuses its receipt. The failed
original scan had no activity row because its entire transaction rolled back.

HR must select the employee and scan month/day in Attendance. Employee My
Attendance reads the same existing DailyAttendanceRecord. A Sunday scan can be
classified Rest Day, and an unassigned employee No Schedule, while still showing
the recorded time. No status or schedule rule was changed to force Present.

## Validation

- **65 RFID integration assertions passed**, including a 15.5-second failed
  post-commit display lookup, committed receipt visibility, retry, original
  name/direction/timestamp and one-event persistence.
- **21 Chrome assertions passed**, including real enrollment, confirmation delay
  beyond the old deadline, lost response, original UUID retry, Asia/Manila display,
  HR/ESS Attendance and Recent RFID Activity.
- TypeScript and focused lint passed. Port **3000** was restored afterward.
- No migration change/application to the normal development schema, database
  reset, existing-record deletion, production operation, push or deployment.

For the actual physical card, keep any still-pending kiosk tab open and use
**Retry Same Scan**. If it was already locked or reloaded, its in-memory pending
input was cleared: reauthorize and scan once. An original UUID cannot be
reconstructed from a rolled-back transaction and a discarded browser request.
The automated success does not claim the original H2 scan was physically replayed.

Final read-only check at `2026-10-25T06:53:46.252Z`: the H2 employee's original
active card assignment was unchanged, and no RFID event existed yet for that
employee. No automatic physical scan or manual substitute was performed. See
`verification/scan-fix-existing-employee.json`.

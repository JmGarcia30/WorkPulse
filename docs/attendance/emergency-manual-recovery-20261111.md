# Emergency Manual Attendance — outage recovery

This adds a focused HR recovery screen to the **existing** attendance architecture.
It does not replace RFID or establish an independent attendance/payroll ledger.

## Location
HR → Attendance → Emergency Manual Attendance
`/dashboard/attendance/emergency` (tenant-aware).

## Intended operation

1. During a power/internet/RFID failure, the organization keeps a signed paper attendance register. Employees record actual Time In/Out and identify the date.
2. Once service returns, HR selects the employee and day, enters the paired actual times, reason, reference to the paper sheet, and incident notes.
3. HR confirms the details in a modal. The backend independently revalidates role, organization, date/time and evidence.
4. Both entries are saved atomically as `AttendanceSource.MANUAL`, with their HR actor, outage reason and paper evidence reference in JSON metadata. The same existing daily attendance projection is used for ESS and payroll calculations.
5. The page alerts HR to review the actual DTR before payroll processing.

## Safeguards

- Tenant-bound staff authorization (HR_ADMIN/ORGANIZATION_ADMIN). Employee self-service users cannot enter someone else's attendance.
- Same-day valid Time In followed by Time Out, not future dated and within the prior 90 days.
- No existing RFID/manual/import events on that employee/day. Conflicting days are redirected to the existing versioned correction process; raw events are never overwritten.
- Rejects days with an earlier correction, approved leave, a finalized attendance projection, or matching finalized payroll entry.
- One transaction for paired events and projection. Idempotency uses the same request ID for retries and rejects reusing an ID with different data.
- The raw attendance-event writer retains its existing immutable-event and organization guards. Manual entries do not claim RFID provenance.
- Current drafts/payroll snapshots still require HR review and explicit payroll recalculation when underlying attendance changes; the emergency form does not silently finalize or alter payroll.

## Limits

- No offline web/app synchronization: the fallback is **paper first**, then HR backfill when the application is reachable.
- No bulk import, no automatic approval attestations, no paid leave override and no overnight/multiple-break shifts in this phase.
- A 90-day self-service entry window; older cases require a separate reviewed correction.
- No automatic edits to already-finalized payroll. Such cases require the organization's authorized correction policy.

## Release gates

- Run Prisma generate, TypeScript, ESLint and a production build.
- On isolated test data: power-outage pair, repeat same token, conflicting second request, mismatched account/tenant, inactive employee, conflicting existing RFID event, approved leave day, finalized payroll, invalid time/time zone, future/too old timestamps.
- Verify event provenance and DTR projection in HR and ESS, and explicit recalculation of any affected unfinished payroll.
- Confirm existing RFID scans and attendance corrections still pass unchanged.
- Test SAGA path and another tenant path, desktop and mobile.
- Feature is draft only. No live attendance writes or production schema changes were made.

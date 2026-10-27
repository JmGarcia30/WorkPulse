# WorkPulse read-only HR report exports (review branch)

Scope: Add **Employee directory CSV**, **Attendance CSV/PDF** and **HR Analytics PDF**. No changes to the underlying HRIS actions, database schema, customer records, billing plans, or production deployment are part of this change.

## Routes and surfaces

- Employee directory: /dashboard/employees -> Export employee CSV -> GET /api/reports/employees
- Monthly attendance: /dashboard/attendance -> Export CSV / Export PDF -> GET /api/reports/attendance
- Workforce analytics: /dashboard/analytics -> Export analytics PDF -> GET /api/reports/analytics

Existing page filters are forwarded through query parameters. Attendance includes its selected month, employee, department, category and visual status; CSV/PDF contain stored records only, not generated calendar dates with no record. Analytics PDF reuses the exact analytics read model, including its existing definitions for finalized payroll totals. PDF headers identify the requesting organization and report period.

## Safeguards

- Downloads are authorized using existing persisted user session, tenant routing and role guards. Employee, attendance, and analytics exports are restricted to HR and organization administrators.
- All data queries derive the organization ID from the session, never a query parameter. Report endpoints never perform inserts, updates or deletes.
- CSV fields are quoted/escaped and formula-looking cells prefixed with an apostrophe; exports have a UTF-8 BOM. PDF text is sanitized for Helvetica's built-in character coverage.
- Attachments use private, no-store cache headers, a safe fixed filename, and a non-sniffable content type.
- Employee export is limited to 10,000 matching records. Attendance limits initial query counts to 10,000 for CSV or 1,000 for PDF. Large queries return a clear 413 without producing the export.
- PDFs use the existing pdf-lib package and create transient bytes in memory. No object-store or public filesystem writes.
- Existing SAGA path tenancy relies on the established workpulse_path_tenant cookie and unprefixed /api requests.

## Verification and release gates

- Run: node -r tsx/cjs scripts/test-report-export-format.cjs
- Run: npx tsc --noEmit; npx eslint src/features/reports src/app/api/reports src/app/'(dashboard)'/dashboard/{employees,attendance,analytics}/page.tsx
- Run: npm run build (requires a verified safe non-production environment).
- In an isolated test organization, exercise Employee CSV with filtered/unfiltered pages; Attendance CSV/PDF with a late attendance entry and an employee filter; Analytics PDF with current/custom dates.
- Verify unknown tenant and missing/foreign HR authentication return no data. Verify HR data remains unchanged, including counts/fingerprints.
- Live app may require SAGA's /saga path and a session cookie on the same host; do not use another organization's credentials or production data to test.

Note: build success does not prove real-browser behavior; do not merge while checks fail. PDF export is a printable summary, not a government-compliant payroll record.

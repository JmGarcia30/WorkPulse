# H5 Final Manual Acceptance

Use a disposable employee created through the normal H1–H4 workflow. Do not reuse historical H2 boundary fixtures.

Required starting state:

- Active employee and active employee account
- Current/open-ended `REGULAR` employment record
- Active current-year SAGA leave policy/cycle
- No manual Sick / Personal entitlement grant
- No schedule assignment initially

Acceptance flow:

1. Sign in as the employee and file Personal Leave.
2. Confirm the request is `PENDING` and displays **Pending calculation**.
3. Sign in as HR and open the request from `/dashboard/leave`.
4. Attempt approval and confirm the request remains pending with the schedule guidance.
5. Follow **Manage Work Schedule** to `/dashboard/attendance/schedules` and assign a Monday–Friday schedule covering the requested dates.
6. Return to the request and confirm the schedule, workdays, final units, and expected return date preview.
7. Approve the request.
8. Confirm exactly one 5-day Sick / Personal entitlement is reflected, the approved units are deducted, and ESS shows `APPROVED`.
9. Confirm the affected DTR days show `APPROVED_LEAVE` without synthetic attendance events.
10. Print the SAGA Leave Form and verify the authoritative units and expected return date.

The automated H5 transaction fixture mirrors this flow with an isolated employee and rolls all fixture data back.

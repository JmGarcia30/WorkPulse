# Exit Management Phase 3: Employee resignation through ESS

Implemented ESS navigation and `/employee/resignation` with the existing tenant
theme, mobile navigation, a simple notice form and paginated status cards.
Employees submit reason, proposed last working day and effective date, confirm the
notice, and see the organization's current policy. Receipt time/notice date and
identity are server-controlled.

Submission reuses the existing case creation/checklist/audit implementation. It
creates one normal `RESIGNATION` draft, not a second separation system. The current
employee/account/role/tenant and employment dates are checked in the transaction.
Actor-scoped request keys, the existing active-case unique index and eligibility
row locks prevent duplicate/spoofed submissions. Short notice and missing policy
are recorded for HR review rather than refusing to lodge a notice.

The existing HR dashboard **Requires Attention** queue is the in-app notification
channel. It shows pending employee notices and links to their existing Exit cases.
There is no separate email/push delivery promise. HR acknowledges receipt through
Exit Management; its employee-visible message appears in ESS and clears the queue
item. Acknowledgment does not approve/reject a notice, change case state, satisfy
SAGA reviews, clear items, revoke access or calculate pay. Administrative checks
remain separate, and acknowledgment is not an approval/execution gate.

The original notice is retained and submitted reason/dates cannot be overwritten.
HR can add processing remarks and complete existing policy, clearance, approval
and execution steps. Cancelling an ESS notice requires confirmation and evidence
of an employee-requested withdrawal, not an HR rejection. Employees track only
their own submissions and limited processing information; HR legal notes, review
evidence, audits, other employees' cases and financial data are not exposed.
Only existing explicit separation execution disables ESS. The same case remains
available to HR for Phase 2 final pay after separation.

Validation:

- Production build/TypeScript and focused lint passed.
- ESS service security/functional suite passed: tenant/employee spoofing, stale
  roles, disabled/inactive accounts, duplicate/replayed requests, invalid dates,
  notification/acknowledgment, immutable originals, privacy, withdrawal/resubmission,
  SAGA reviews, explicit execution and reuse of final pay.
- Actual production HTML/Server Action tests passed for employee submission and
  tracking, HR Requires Attention, receipt acknowledgment, processing updates,
  duplicate prevention, cross-employee/tenant/role denial and disabled sessions.
- Existing Phase 1 policy and Phase 2 final-pay regressions passed.
- Existing H10.1 passed 84 checks through its rollback adapter, validating shared
  case creation, clearance, idempotency and historical preservation.
- Migration and test checks confirmed all 67 existing tables' prior data unchanged;
  fixtures rolled back and the original `.env` remained unchanged.

Evidence is in `preservation.json`, `tests.json` and `interface.json`, with the
existing phase reports under `docs/exit-policy/`, `docs/final-pay/` and
`docs/functional-regression/adapted-h10-1.json`. These tests use rollback fixtures
and serialized savepoints. Independently committed concurrency and visual browser
coverage are not claimed; the H10 adapter substitutes client-boundary audit fault
injection and omits its native TRUNCATE rejection assertion.

Only the verified recovery target received the additive case-metadata migration.
No production database changes, resets, Git pushes or deployments were performed.

## Local verification commands

```powershell
node scripts/exit-policy-checks.cjs generate
node scripts/exit-policy-checks.cjs lint
node scripts/exit-policy-checks.cjs build
npm run test:ess-resignation
npm run test:ess-resignation-interface
```

The scripts validate the existing recovery identity and keep fixture changes
inside a rollback transaction. Restart development after generating the client so
the new case fields are available.

## Manual local testing

1. Restart `npm run dev` in the workspace. It uses the verified recovery profile.
   Use disposable recovery employees, not existing staff records, for workflow tests.
2. Sign in as an active employee with an active ESS account and open **Resignation**.
   Confirm the displayed tenant policy and organization date. SAGA should show one
   calendar month and superior/HRMO review requirements; another tenant should show
   its configured policy or explicit missing-policy guidance.
3. Enter a reason and future dates. Set the effective date after the last working
   day and far enough after today to satisfy the displayed policy for a compliant
   example. Confirm and submit. Verify a reference/status card appears, ESS remains
   accessible, and no second active form is offered. Replaying a stale submission
   must not create another case. Short-notice examples should be recorded for HR
   review, not silently granted an exception.
4. In another browser, sign in as the same tenant's HR Administrator. Open
   **Dashboard → Requires Attention → Exit**, then the notice's existing Exit case.
   Confirm the preserved original notice and pending checklist. Record **Acknowledge
   receipt** with a public message; do not record documentary reviews automatically.
5. Refresh ESS and verify the receipt message/status. Refresh HR Dashboard and
   verify the pending receipt notification cleared. The case remains a draft until
   HR starts processing. A second employee must not see the notice, including when
   supplying its employee ID in a URL; another tenant's HR must not access the case.
6. In Exit Management, use **Edit case / start processing** to add administrative
   remarks and start processing. Submitted reason/dates remain read-only. Complete
   the existing clearance and documentary review steps as appropriate. ESS should
   show HR processing/clearance counts without displaying private HR notes.
7. On or after the effective date, use the existing explicit administrative
   approval/execution workflow. Confirm ESS is denied afterward and HR can open
   **Final Pay Management** on the same case. The automated service suite covers
   this boundary today with its trusted test clock; the application has no browser
   clock override and does not execute early.
8. For withdrawal testing, HR cancellation without verified employee withdrawal
   evidence must fail. With an actual test employee withdrawal reference and
   confirmation, record withdrawal, verify ESS shows it as withdrawn, and submit a
   fresh notice with a new request key if needed. The prior notice/audit remains.

Limitations are intentional: in-app queue notifications are visible on dashboard
refresh/navigation, not email/push; ESS does not edit or withdraw lodged notices
directly. Backdated receipt entry and date-amendment workflows are not provided.
Existing access revocation means post-separation notice/final-pay inquiries go to HR.

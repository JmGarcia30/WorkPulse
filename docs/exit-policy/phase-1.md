# Exit Management Phase 1 — organization resignation policies

Implemented organization settings at `/dashboard/settings/exit`, linked from
Organization Settings, the Settings navigation and Exit Management. Only the
organization's current persisted HR_ADMIN can save notice requirements. Organization
Admins can inspect them. Tenant/actor IDs cannot be supplied by policy input.

Non-SAGA organizations choose calendar days or months and whether authorized
short-notice exceptions are permitted. Missing/invalid configuration fails closed
with guidance. SAGA retains one calendar month, month-end clamping, both notice
reviews and its existing exception behavior; its settings are fixed.

Existing services calculate notice and enforce it at readiness, approval and
execution. Cases capture policy snapshots. Settings changes preserve configured
cases. For an editable case awaiting its first policy, save its details after
configuration to capture the policy; the existing audit records the old/new
snapshots and existing review/exception invalidation still applies.

Validation completed on the verified recovery environment:

- Production build and focused lint passed; build TypeScript checks passed.
- 11 focused service scenarios passed, including non-SAGA completion, missing
  policies, days/months, SAGA preservation, allowed/disallowed exceptions, snapshot
  retention, termination, account disabling and tenant/role denial.
- 9 rendered-HTML/HTTP Server Action scenarios passed, including settings save,
  missing-policy guidance, SAGA's locked settings and unauthorized submissions.
- Existing H10.1 (84 checks) and H10.2 (57 checks) passed through rollback adapters.
  These adapters serialize fixtures: independent committed concurrency and the
  real attendance-lock race were not revalidated. No visual browser claim.
- Migration and fixture preservation checks confirmed 64 pre-existing tables
  unchanged. Fixtures rolled back; the original `.env` remained unchanged.

Only the nullable `Organization.resignationPolicy` column was added to the
verified recovery database. No organization policies were backfilled. Production
was not modified; no reset, push or deployment was performed.

Reproduce from the workspace with the existing verified recovery profile:

```powershell
node scripts/exit-policy-checks.cjs generate
node scripts/exit-policy-checks.cjs lint
node scripts/exit-policy-checks.cjs build
npm run test:exit-policy
npm run test:exit-policy-interface
```

Restart `npm run dev` and open Settings → Resignation Notice Policy for local UAT.
Use disposable recovery employees when testing final execution.

Remaining Exit scope is unchanged: final-pay calculation/payment, ESS resignation
submission/tracking, automatic effective-date execution and rehire/reactivation
are not implemented. HR executes approved cases explicitly.

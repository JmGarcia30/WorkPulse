# Exit Management Phase 2: Final Pay Management

Implemented in the existing Exit case detail page, using the existing separation
authorization and transaction boundary. HR Administrators can create one draft per
case, record reviewed inputs, review the calculation, explicitly approve/finalize
amounts, and record partial/full payment receipts. Organization Admins retain read
access. Tenant and actor identity are derived from the authenticated workspace.

The itemized PHP breakdown supports:

| Component | Reviewed calculation |
| --- | --- |
| Unpaid earned salary | Verified gross earned for the unsettled period less verified gross-equivalent salary already settled |
| Proportionate 13th month | Verified calendar-year basic earned / 12 less verified prior 13th-month payments |
| Applicable unused leave | Verified convertible days × reviewed daily conversion rate |
| Applicable separation pay | Externally reviewed amount with specific separation-ground and legal/contractual computation evidence |
| Additions/refunds and deductions | Explicit externally reviewed amounts, with itemized evidence and lawful basis |

All components start unreviewed. Missing/unsupported inputs leave totals
undetermined and prevent review/approval. The panel displays existing payroll,
compensation, attendance and leave evidence. It never treats payroll finalization
as proof of disbursement or assumes all leave balances are cashable. Monetary
arithmetic reuses payroll Prisma.Decimal and monetary validation; no automatic
final tax or statutory separation-pay multiplier is introduced.

Approval requires completed separation, explicit HR review and current source
evidence. Approved amounts, evidence, receipts and audits are protected from
updates/deletion. Source changes before approval require renewed review. Source
changes after approval are flagged for external reconciliation, while the approved
snapshot remains historical. Unique case/reference/request-key constraints,
parent-row payment locking and database validation prevent duplicate/excess
receipts. No bank transfer is initiated.

Deadline tracking uses DOLE's 30-day rule and shorter documented organization or
individual/CBA terms. It starts at effective separation, independently of
clearance, approval, execution and payment recording. New shorter organization
terms must be adopted before final approval; finalized records retain their
approved deadline/basis so later settings do not relabel historical payments.
Unpaid balances show overdue status; completed receipts show paid-on-time/late.
The applicable earlier December 24 deadline for 13th-month pay is displayed for
separate allocation/reconciliation review. Cancelled cases retain draft history
without approval/payment eligibility or an active overdue obligation.

Validation evidence:

- Production build and focused lint passed; build TypeScript checks passed.
- Focused final-pay service regressions passed (`tests.json`): calculations,
  missing inputs, source changes, explicit approval, payment idempotency,
  overpayment denial, deadlines, immutable history, tenant/role authorization,
  termination/zero settlements and preservation.
- Rendered production HTML and actual Server Actions passed (`interface.json`):
  create, reviewed input save, review, approval, payment retry, foreign-session
  rejection and stale finalized-edit rejection.
- Phase 1 policy regressions passed: SAGA, non-SAGA policies, exceptions,
  termination and ESS revocation.
- Existing H10.2 passed 57 checks through its recovery rollback adapter.
- Prisma cache regression passed 13 checks, including stale clients predating
  the final-pay delegates.
- Tests use rollback fixtures; independently committed concurrency and visual
  browser coverage are not claimed. The H10 adapter substitutes client-boundary
  audit failure injection and skips its independent attendance-lock race.

The additive migration was applied only to the verified recovery target. It
preserved the contents of all 64 pre-existing tables; later fixture checks
preserved all 67 tables. Existing organization policies were not backfilled or
rewritten. The original `.env` was unchanged. No production database changes,
resets, pushes or deployments were performed.

Reproduce in the verified recovery workspace:

```powershell
node scripts/exit-policy-checks.cjs generate
node scripts/exit-policy-checks.cjs lint
node scripts/exit-policy-checks.cjs build
npm run test:final-pay
npm run test:final-pay-interface
node scripts/test-exit-organization-policy.cjs
node scripts/exit-policy-checks.cjs cache
```

For manual UAT, restart `npm run dev`, sign in as an HR Administrator, and open
Employees → Exit Management → a disposable recovery case → Final Pay Management.
Inspect evidence, save explicit component inputs and applicability, record review,
complete separation, approve amounts, then record an actual test receipt. Use
Settings → Resignation Notice Policy → Final-pay payment deadline for organization
terms. Separation/ESS termination can complete with no final-pay record or payment.

Unsupported automation and legal sources are documented in
[legal-basis.md](./legal-basis.md). Qualified review remains necessary for taxes,
eligibility, statutory separation/retirement awards, currency conversion and
special coverage. Payment correction/reversal and automated disbursement are not
provided in this phase.

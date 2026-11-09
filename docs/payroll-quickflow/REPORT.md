# WorkPulse — Employee-focused payroll quick flow (review build)

Branch: `feature/payroll-quickflow-20261109`

## Scope delivered

- Adds a prominent **Quick Employee Payroll** section to the existing HR payroll page.
- Select an existing payroll period and an active employee; review saved compensation and preparation status.
- Calculate only the selected employee's draft/review entry with the existing **payroll generation engine**. Its organization and active-employee guards, period lock, employee lock, attendance evidence, withholding/statutory logic, and immutable existing-entry rules remain in force.
- Review stored gross, basic pay, deductions, attendance snapshot and net pay; show the existing detailed recorded deduction breakdown (SSS, PhilHealth, Pag-IBIG, withholding, late, absence, undertime).
- Use existing period-wide review/finalize controls. Finalization still requires complete valid entries for *all* eligible employees in the cutoff and still locks official payslips before they become visible in ESS.
- After finalization, notify only the selected employee via the existing persistent in-app notification service (recipient preview token, finalization checks and duplicate suppression remain).
- Keep the existing full-period operations under a collapsed **Advanced** section rather than deleting them.
- No new database migration, calculation formula, payroll policy, permission grant, or production data change.

## Important operational boundaries

- Pay is **read from an already verified compensation record**, not typed as an arbitrary new gross amount into the quick form. Payroll Settings remains where HR configures salary and reviews agency evidence.
- Approved overtime/additional earnings still require the existing supported classification and evidence process. Recorded attendance alone does not create overtime pay without authorization.
- Missing statutory coverage, opening balances, contribution basis, attendance approvals, or previous-cutoff history are not bypassed or defaulted to zero.
- This **does not implement** a Finance Officer payroll administration workspace. Finance roles remain subject to existing server permissions.
- An individual calculation is a draft entry within a **period-wide** payroll. Individual payslips become official only when the whole period has passed review and finalization.
- Notifications are in-app ESS notifications, not SMS or email.
- This is a review branch. **Do not merge/deploy to production without testing.**

## Validation evidence and blocker

- Vercel preview builds for earlier commits on this branch completed compilation and TypeScript successfully, but failed while collecting Next.js page configuration with `WORKPULSE_DATABASE_IDENTITY_REJECTED` in `/api/branding/[kind]`. This is an enforced preview database-identity safeguard, not an approved reason to bypass it.
- The latest preview build and an authenticated browser walkthrough have **not** been confirmed successful as of report creation.
- No production migration or data write was performed here.
- Local uncommitted payroll recovery work on the user's computer was not accessed or modified by these GitHub branch changes.

## Required acceptance checks

1. In a verified isolated nonproduction environment, run Prisma validation, TypeScript, changed-file ESLint, production build, and payroll regressions. Keep the correct preview database identity; do not disable checks.
2. With an HR account, choose a cutoff and employee. Confirm saved salary and readiness are correct.
3. Calculate one employee and confirm that another employee in the same cutoff is not generated. Recalculate/duplicate requests must not duplicate entries.
4. Verify invalid/foreign/inactive employee IDs fail and never create cross-tenant records.
5. Confirm absent/late/undertime calculations, supported overtime earnings, and statutory allocation match prior engine results. Missing evidence must block calculation.
6. Confirm whole-period review/finalization is impossible until *all* eligible employee entries are ready.
7. After finalization verify the selected employee sees the payslip in ESS, and the notification action only creates that person's alert. Repeats must not duplicate alerts; invalid recipients must be rejected.
8. Verify advanced full-period generation, review, notification, existing payslips, leave, RFID, and payroll periods remain functional.
9. Do not authorize production release until the reviewed preview build and browser checks pass.


# HR Notifications and Automatic Job Closing — QA / Release Gate

Stacked branch: `feature/hr-deadlines-notifications-feedback-20261110` (PR #20, depends on PR #19).

## Scope

- Daily authenticated scheduled closeout; closes expired PUBLISHED jobs to CLOSED, **not ARCHIVED**.
- Closing-date comparisons are inclusive of the entire date in the organization's IANA timezone. A date of Nov 10 allows applications until Nov 10 ends locally.
- Public career directory, tenant landing and application routes hide past-deadline jobs immediately, even before scheduled closeout.
- Centralized HR notification inbox: recent applications, pending leave, published job deadlines (3 days), payroll that is not finalized near pay date, and auto-closed job events.
- Per-user unread receipts scoped by organization and user. No applicant PII duplicated in notifications.
- Existing application, interview, payroll and ESS workflows are preserved.

## Configuration required before Production

1. Merge and validate PR #19 before PR #20; do not cherry-pick PR #20 onto an unrelated branch.
2. Back up and apply only the reviewed additive `20261110000100_hr_notification_reads` migration using existing migration release process. Verify `_prisma_migrations` and no pending migrations.
3. Configure **CRON_SECRET** as a strong secret in Vercel Production. Without it the job scheduler returns HTTP 503 and auto-close will not run.
4. Vercel daily cron: `0 0 * * *` (UTC). Applications stop promptly via request-time checks even before the next cron. The cron closes at most 100 expired jobs per run; inspect `moreDue` for backlog.
5. Confirm Vercel account supports this schedule. Check that cron requests include `Authorization: Bearer <CRON_SECRET>`; never expose the value.

## Required isolated tests (not automatically implied by a successful build)

- Deadline is **inclusive** at 23:59:59 of local closing date; expires at 00:00 of next day (Asia/Manila, UTC and a daylight-saving timezone).
- Missing date means no automatic expiration. Invalid/past dates return a useful validation error.
- Cross-tenant organization cannot see jobs or notifications belonging to another tenant.
- Public career directory, SAGA preview, job detail, apply page and application submission reject expired published positions.
- HR publishing a past-deadline job is rejected; editing deadline to the future works.
- Cron without/incorrect `CRON_SECRET` returns 503/401; authorized invocation closes only due jobs and records a durable JOB_AUTO_CLOSED event.
- Duplicate/concurrent cron invocations do not create duplicate events or delete applications.
- More than 100 due jobs return `moreDue` and remain eligible for a future run.
- HR inbox shows accurate unread counts and routes; marking read is user-scoped, tenant-scoped and rate-limited. Other HR users do not inherit the read state.
- HR, employee and public error boundaries expose only safe messages and provide retry/navigation controls.
- Verify Basic/Pro active publication limits after date expiration, and no old applicant history is lost.
- Run targeted hiring, careers, login, subscription/payroll regression suites against synthetic data; check desktop/mobile UI.

## Deployment status

PR remains **draft**. Source build / typecheck and a synthetic preview migration do not prove authenticated browser behavior, job cron execution or Production readiness.

# WorkPulse defense-demo readiness

Date: 2026-11-02 Asia/Singapore. Tested SHA: `cfcbd8512edbc3e74148e2541ed03bc9f37ec3cd`.

## Decision

**NO-GO for an unrestricted current-date production-backed demonstration.**

A **CONDITIONAL GO candidate** exists for a rehearsed, isolated synthetic demonstration, with September 2026 payroll and the exclusions below. This is not approval to deploy, migrate production, or use real employee/applicant/payroll records.

The primary blockers are the missing protected-production OTP migration, expired verified payroll-rule coverage, confirmed failed-job-edit data loss, and gaps in complete browser/hardware rehearsal. Lint also fails. The exact newer GitHub revision has not been executed.

## Demonstration candidates supported by evidence

| Area | What can reasonably be prepared | Evidence/qualification |
|---|---|---|
| Company registration | Synthetic company registration using local test inbox; OTP resend/cross-device verification; first HR login and branding | 27 browser checks plus 61 service assertions. Requires the fully migrated isolated environment. |
| Tenant routing and branding | Existing synthetic workspaces, scoped login/dashboard, configured brand | Browser and 64 routing assertions. Do not expose production data. |
| Platform onboarding | Synthetic organization/HR initialization and activation | 60 service assertions; platform list/detail pages observed. Full platform account CRUD browser rehearsal still required. |
| HR page tour | Empty/list/entry pages across hiring, employees, attendance, leave, payroll, organization and analytics | 57 route/viewport checks, actual desktop/mobile rendering. Page rendering is not proof that every operation works. |
| Recruitment | Prepared, fully reviewed synthetic candidate; prerequisites and final conversion | 61 PostgreSQL checks and category coverage. The full browser journey did not complete; use only after an exact rehearsal. |
| ESS | Prepared active synthetic employee account and scoped records | Service ownership/activation/read-model tests passed. Complete user-facing sequence must be rehearsed. |
| Attendance and leave | Prepared schedule and synthetic attendance/leave balances; keyboard RFID scanning | 39 attendance, 65 RFID service, 21 browser scan and 103 leave assertions. Kiosk HR-cookie removal fails; physical hardware remains untested. |
| Historical payroll | Explicitly labeled September 2026 example, reviewed inputs and opening history, finalized synthetic payslip | Current workflow/integration/presentation suites passed. PHP 35,000 sample net is 30,473.70 with the stated assumptions. |
| Exit and final pay | Reviewed synthetic notice/case and clearly identified financial assumptions | Resignation and final-pay services passed. Complete clearance/separation browser rehearsal remains required. |

No entire module is certified unconditionally safe to demonstrate solely from its build or list-page rendering. The most complete actual browser evidence is the registration/initial HR/branding flow.

## Exclusions and limitations

- **Current-date payroll:** Do not claim November 2026 payroll is supported. All three contribution agencies reject November; BIR rejects payment dates after October 22. October month-end payroll is also blocked. Do not change system dates or disable/extend rule checks merely for the defense.
- **Protected production registration:** Do not use current OTP code with the protected database until the missing migration and deployed code revision are reviewed and released through a separately authorized process.
- **Job editing:** A malformed edit can remove structured requirements before rejection. Avoid unrehearsed edits; preserve synthetic job copies and require QA-BUG-004 regression before demonstrating error recovery.
- **Latest redesign:** Remote main has three newer SAGA application styling commits. Apply-page/theme/button behavior needs checking on the selected defense revision.
- **Public applicant journey:** Actual applicant submission, organization recruitment-mail delivery, resume AI parsing, candidate document submission and browser offer acceptance were not completed as one end-to-end journey.
- **RFID:** The final HTTPS run passed 21 keyboard/workflow assertions, including HR/ESS synchronization, but exits 1 because the revoked HR cookie remains in Chrome after kiosk authorization. Server-side revocation passed separate tests. Resolve/rehearse cookie clearing; physical reader, cards, suffix behavior and USB/device stability still require human testing.
- **Platform accounts/employment lifecycle:** Older suites contain invalid/stale fixtures and did not fully pass. Supported service tests should not be stretched into a claim that every account/profile/renewal path is verified.
- **Exit:** One legacy standalone suite stops after 35 assertions on a loader error. Separate final-pay and resignation services pass, but a complete exit browser flow is still required.
- **UI/accessibility:** The mobile matrix uses an empty synthetic company. Large populated tables, every dialog, screen-reader usage and all error/loading states are not certified.

## Required pre-defense checklist

1. Select and record the exact defense commit/build and environment. Include the three newer UI commits only after checking them. Freeze unrelated changes after the final rehearsal.
2. Use a verified non-production dataset with synthetic employees, applicants, schedules, balances and salary inputs. Provide a reset/recovery procedure restricted to that dataset.
3. Review the production migration gap if a production-based demonstration is proposed. This QA did not apply it or authorize a production release.
4. Resolve or explicitly remove current-date payroll from scope. Any coverage update needs independent statutory review, effective-date tests and accounting validation.
5. Review and fix job-edit atomicity, then execute its failed-edit and normal-edit regressions. This QA implemented no fix.
6. Restore a trustworthy lint/test gate and update legacy fixtures to current security, hiring, legal-review and payroll prerequisites.
7. Rehearse with an actual browser from platform/HR registration through recruitment, conversion, employee login, schedule/attendance, leave, historical payroll/ESS payslip and exit. Confirm screens and data after refresh and login changes.
8. Test the physical RFID reader and defense laptop/kiosk: leading zeroes, Enter/no-Enter suffix, invalid/deactivated cards, repeats, Time In/Out, focus recovery, disconnect/reconnect, HR/ESS synchronization and loss/retry behavior.
9. Confirm test email delivery only to the controlled inbox. Check the relevant deployment's storage/OAuth/AI configuration without sending to real applicants or employees.
10. Prepare a backup recording and screenshots of synthetic flows, supported historical payslip, and expected fail-closed messages. Assign an operator to recover from network/database interruption.

## Suggested restricted demonstration sequence

1. Show public registration and the controlled test inbox. Verify the code and sign in as the newly created HR administrator.
2. Save branding and show the tenant-specific dashboard.
3. Use prepared synthetic recruitment data to explain screening, interviews, assessment, reviewed offer and onboarding gates. Demonstrate conversion only after a successful exact browser rehearsal.
4. Use a prepared employee to show own ESS records, attendance and leave. Run RFID only after equipment/software rehearsal.
5. Clearly identify the payroll as **September 2026 synthetic payroll**. Show verified setup/history, calculation breakdown and finalized ESS payslip; explain that current-date rules fail closed pending review.
6. Show prepared exit/final-pay evidence only if the full browser sequence has been rehearsed.

Stop a workflow if its required configuration/readiness check fails; show the expected blocker and move to the prepared backup. Do not make production changes or weaken prerequisites during the presentation.

## Evidence and report links

- [Main report](REPORT.md)
- [Detailed results and coverage gaps](TEST-RESULTS.md)
- [Defects, configuration findings and regressions](BUGS.md)
- [Execution index](evidence/execution-index.json)
- [Registration browser checks](evidence/legacy/docs/company-registration-otp/browser-tests.json)
- [Desktop/mobile matrix](evidence/legacy/docs/company-registration-otp/qa-layout-matrix.json)
- [Independent statutory results](evidence/statutory-independent.json)

All recommendations await team/ChatGPT review. No fixes, production migrations, pushes or deployments were performed.

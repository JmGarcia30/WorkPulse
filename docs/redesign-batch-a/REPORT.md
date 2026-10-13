WorkPulse internal redesign — first batch

**1. Existing UI problems found**

The HR shell and feature pages used different visual systems: tenant-aware shell colors mixed with fixed black and indigo actions, 10–11px labels, oversized rounded cards, and inconsistent tables and forms. The dashboard prioritized large quick-action cards ahead of operational information. Candidate and employee profiles had long unstructured scroll paths. Onboarding used large cards that made candidates difficult to compare.

The working tree already contained ESS/H7 and Analytics/H8 work. That work was inspected and retained. The sidebar's existing Analytics entry remains. No reset, checkout, clean, migration, or business-domain rewrite was performed.

**2. Design system created**

Internal styles are scoped to the HR workspace in `src/app/(dashboard)/workspace.css`. Tokens cover warm neutral backgrounds, white surfaces, text, borders, compact radii, and configurable tenant accents. Existing `TenantTheme` branding remains the source for organization identity, primary/accent colors, and readable action foregrounds.

Reusable additions are `MetricStrip`, `WorkspacePanel`, `HiringWorkspaceNav`, `SectionNav`, and `DialogFrame`. Native dialogs provide modal semantics, focus containment/restoration, Escape handling, and scroll locking. Search/filter controls and forms have improved accessible names. Shared empty, loading, and error components receive scoped internal styling and announcement semantics.

**3. Pages redesigned**

- HR shell, sidebar, header, breadcrumbs, and mobile navigation.
- `/dashboard`: workforce summaries, attention queue, hiring stage counts, attendance/leave/probation summaries, payroll status/setup checks, and quick actions. Data comes from existing organization-scoped records.
- Hiring pipeline, job openings, job detail/create/edit, applicant directory/detail, interviews, assessments, offers, and onboarding.
- Candidate workspace: candidate/contact details, documents and AI resume analysis, interviews/evaluations, assessments, offers, onboarding requirements, readiness, status controls, and history.
- Onboarding: compact summaries and a comparison table with real progress, review counts, checklist navigation, and employee handoff links.
- Employee directory/profile: readable filters and tables, section navigation, employment/probation history, lifecycle decisions, contract compliance, source hiring record, and ESS account administration.

**4. Functional flows preserved**

Existing server actions, domain rules, organization context, session validation, role permissions, teaching/non-teaching requirements, offer approvals, mandatory readiness checks, hire conversion, employment source-of-truth selection, historical records, probation actions, and ESS provisioning/activation/disable/enable actions remain in use. No H1–H8 business logic or historical migrations were edited for this batch.

Hiring Managers receive hiring information and cannot access employee directory/profile data or HR/payroll dashboard panels. Employee links are shown only to authorized HR/Admin users. Browser checks also verify that cross-tenant candidate details are not exposed.

ESS account actions use the same server actions and confirmation flags, with consistent dialogs replacing browser prompts. Browser verification cancels the disable dialog without submitting a change. Lifecycle changes are covered by the existing regression suites rather than applied to existing employees during UI checks.

**5. Bugs discovered or fixed**

- Hiring breadcrumb pointed to a route with no page; it now links to the pipeline.
- Mobile navigation lacked sign out; it now includes the existing logout action.
- Onboarding search dropped the selected status; it now preserves the filter.
- Applicant stage filtering omitted several lifecycle stages; all existing statuses are now available with readable labels.
- Inactive employees used a green active-looking badge; inactive status now uses a neutral badge.
- Employee profile overflowed on mobile; header wrapping and grid minimum widths were corrected.
- Hiring and document UI contained a fixed organization slug and SAGA display copy; links now use the actual organization slug and headings use organization-neutral copy. Legacy stored synchronization markers and document policy templates are preserved.
- Interviewer loading could leave stale updates or unhandled failures after closing a dialog; client-side cancellation and error feedback were added.
- Automatic onboarding reconciliation could reject without feedback during navigation. Authorized client requests now handle rejection, and manual reconciliation distinguishes error and success feedback. The underlying reconciliation action and verification rules are unchanged.
- Repository lint failures remain in older diagnostic/test scripts; their locations are listed in the lint evidence.

**6. Verification results**

| Check | Result |
| --- | --- |
| TypeScript: `npx.cmd tsc --noEmit` | Passed |
| Full repository lint: `npm.cmd run lint` | 7 existing errors and 84 warnings; errors are in diagnostic/test scripts; see `lint-results.json` |
| S1 SaaS shell | Passed, 10 assertions |
| H1 employee core | Passed, 22 assertions |
| H2 employment/probation | Passed, 24 assertions |
| H4 ESS regression, including existing uncommitted work | Passed |
| H8 Analytics integration | Passed, 44 assertions |
| Interview/evaluation regression | Passed, 15 tests |
| Assessment/offer regression | Passed, 17 tests |
| Onboarding regression | Passed, 18 tests |
| Ready-to-hire gate | Passed, 5 scenarios |
| Recruitment/onboarding sync | Passed, 25 checks |
| Next.js production compilation: `npx.cmd next build --webpack` | Passed |
| Standard `npm.cmd run build` | Blocked at Prisma generation by a locked Windows engine DLL; also reproduced outside the sandbox. Next.js compilation passed using the already generated client. The existing development server was retained. |
| `git diff --check` | Passed |
| Headless Edge desktop/tablet/mobile checks | Passed, 47 checks; results in `browser-results.json` |

Browser coverage includes HR login/dashboard, all hiring list routes, applicant details, onboarding, employee directory/profile, dialog focus/Escape, ESS confirmation/cancellation, mobile navigation/sign out, Hiring Manager restrictions, and a second tenant's organization name/colors. Screenshots are saved beside this report. Existing regression tests use their own fixtures and cleanup; no seed or migration was run.

**7. Files changed**

The source inventory is in `changed-files.json` and reproduced below. The existing uncommitted package, ESS, permissions, and Analytics changes are excluded from this batch's inventory except for the sidebar, where the new styling preserves the pre-existing Analytics entry. Verification artifacts are contained in this directory.

**8. Remaining screens to redesign**

Attendance, Leave, Payroll, Analytics, and the ESS portal remain for the next batch; they inherit the shared HR shell where applicable. Organization settings and login retain their existing page layouts. Public marketing pages were not redesigned. Exit, RFID, PayMongo, and subscriptions remain outside scope. Work stops after this batch.

Full source inventory:

```text
src/app/(dashboard)/dashboard/employees/[employeeId]/page.tsx
src/app/(dashboard)/dashboard/employees/layout.tsx
src/app/(dashboard)/dashboard/employees/page.tsx
src/app/(dashboard)/dashboard/hiring/applicants/[applicationId]/page.tsx
src/app/(dashboard)/dashboard/hiring/applicants/page.tsx
src/app/(dashboard)/dashboard/hiring/assessments/page.tsx
src/app/(dashboard)/dashboard/hiring/interviews/loading.tsx
src/app/(dashboard)/dashboard/hiring/interviews/page.tsx
src/app/(dashboard)/dashboard/hiring/jobs/[jobId]/edit/page.tsx
src/app/(dashboard)/dashboard/hiring/jobs/[jobId]/page.tsx
src/app/(dashboard)/dashboard/hiring/jobs/new/page.tsx
src/app/(dashboard)/dashboard/hiring/jobs/page.tsx
src/app/(dashboard)/dashboard/hiring/layout.tsx
src/app/(dashboard)/dashboard/hiring/offers/page.tsx
src/app/(dashboard)/dashboard/hiring/onboarding/page.tsx
src/app/(dashboard)/dashboard/hiring/pipeline/loading.tsx
src/app/(dashboard)/dashboard/hiring/pipeline/page.tsx
src/app/(dashboard)/dashboard/page.tsx
src/app/(dashboard)/layout.tsx
src/app/(dashboard)/workspace.css
src/components/employee-self-service/EmployeeAccountPanel.tsx
src/components/employees/EmploymentLifecycleActions.tsx
src/components/hiring/ApplicationCard.tsx
src/components/hiring/ApplicationPipeline.tsx
src/components/hiring/ApplicationPipelineColumn.tsx
src/components/hiring/ApplicationTimeline.tsx
src/components/hiring/AssessmentModal.tsx
src/components/hiring/AssessmentResultModal.tsx
src/components/hiring/CandidateAssessmentsSection.tsx
src/components/hiring/CandidateDocumentsSection.tsx
src/components/hiring/CandidateInterviewsSection.tsx
src/components/hiring/CandidateLifecycleStepper.tsx
src/components/hiring/CandidateOffersSection.tsx
src/components/hiring/CandidateOnboardingSection.tsx
src/components/hiring/CustomOnboardingTaskModal.tsx
src/components/hiring/EvaluationModal.tsx
src/components/hiring/HiringReadinessCard.tsx
src/components/hiring/InterviewCard.tsx
src/components/hiring/InterviewModal.tsx
src/components/hiring/OfferModal.tsx
src/components/hiring/OfferStatusDialog.tsx
src/components/hiring/OnboardingTaskReviewModal.tsx
src/components/hiring/OnboardingTaskUploadModal.tsx
src/components/hiring/ParsedResumeSection.tsx
src/components/hiring/RequirementsBuilder.tsx
src/components/hiring/ResumePreviewModal.tsx
src/components/hiring/StatusChangeDialog.tsx
src/components/layout/DashboardHeader.tsx
src/components/layout/DashboardSidebarNav.tsx
src/components/layout/WorkspaceNav.tsx
src/components/ui/DialogFrame.tsx
src/components/ui/EmptyState.tsx
src/components/ui/ErrorState.tsx
src/components/ui/LoadingSpinner.tsx
src/components/ui/Workspace.tsx
```

# WORKPULSE PERFORMANCE OPTIMIZATION — BATCH 3 REPORT

Implemented targeted Attendance and payroll generation improvements. No Dashboard/UI change, schema/index change, production migration or deployment. Existing H1–H10 and Batch 1/2 changes are preserved.

## 1. Attendance bottlenecks fixed

- Effective employment eligibility now uses one tenant-scoped Employee/EmploymentRecord join instead of hydrating an employee and its employment relation. The latest effectiveFrom record, exclusive effectiveTo boundary and organization-local day bounds are unchanged.
- Schedule loading now uses one parameterized query for the effective assignment, version grace period, requested weekday and that day's breaks. It no longer hydrates the group, version, all seven weekdays and their breaks through separate Prisma relation queries.
- Event ingestion reuses the organization timezone already read inside its own transaction. Nothing is cached across transactions, employees or tenants.
- The existing per-employee/day Serializable transactions remain. There is no unbounded period transaction or unsafe bulk write. Event insertion/projection and correction/projection still commit atomically.
- Serialization/deadlock failures reported as P2034 receive at most two retries, each as a new Serializable transaction. Event and correction authorization is reread on every attempt. P2028, domain errors and arbitrary failures are not retried. Timeouts were not increased.

Attendance status derivation, pairing, duration arithmetic, leave disposition and audit evidence are unchanged. Missing schedules remain NO_SCHEDULE, rest days remain REST_DAY, and an unfinished day remains OPEN. Existing ABSENT derivation still requires the existing completed scheduled-workday conditions; missing data in an ordinary page read never creates attendance records.

## 2. Payroll generation optimizations

Compensation, attendance and approved leave/request data are now read together in one parameterized SQL statement immediately before calculating each employee's entry. This replaces three Prisma reads plus an additional leave-request hydration query when leave exists. The projection contains only fields used by the calculation/snapshot.

This deliberately batches related inputs per employee, rather than preloading mutable data for the whole organization. Later employees therefore receive a fresh read when their turn begins. Each input set has one PostgreSQL statement snapshot. Existing caller-owned transactions are honored; no new long generation transaction or changed write boundary was introduced.

The employee list, authorization, policy resolution, existing-entry skip set, full-period ACTIVE compensation predicates, inclusive compensation end date, attendance completeness checks, Decimal formulas, setup errors, snapshots, create-only behavior and duplicate-key handling remain intact. Decimal database values are projected as text and reconstructed as Prisma.Decimal; date-only values are reconstructed explicitly in UTC. Generation continues to perform one guarded entry create per eligible employee.

## 3. Dashboard improvements

Dashboard remains unchanged. Attendance and payroll correctness were the priority; this batch did not establish an additional measurable Dashboard hydration improvement. Batch 2's existing Dashboard optimizations are preserved. Dashboard response time, SQL and browser navigation were not remeasured in Batch 3.

## 4. Before-and-after SQL counts

Actual warm medians, including Prisma-emitted transaction controls and pool probes:

| Workload | Before SQL | After SQL | Reduction |
|---|---:|---:|---:|
| Attendance: 3 employees × 3 days | 141 | 95 | 32.6% |
| Payroll generation: 5 employees | 26 | 16 | 38.5% |
| Payroll generation: 50 employees | 208 | 107 | 48.6% |
| Payroll generation: 100 employees | 409 | 208 | 49.1% |

For fully eligible employees without leave, generation's application operations scale approximately as 6 + 4N before and 6 + 2N after. Driver pool probes explain the small additional emitted-statement counts. Approved leave formerly required an additional relation query; the new statement joins the request directly. This is a constant-factor improvement, not constant-query generation: employee input reads and individual writes remain O(N).

Attendance retains O(employees × days) atomic units; the reduction is in work inside each unit. Measured warm SQL ranges were 141 before versus 95–96 after for nine employee-days; payroll ranges are in summary.json.

## 5. Before-and-after timings

Local service processing medians, milliseconds:

| Workload | Before ms | After ms | Reduction |
|---|---:|---:|---:|
| Attendance: 3 employees × 3 days | 12,808 | 8,518 | 33.5% |
| Payroll generation: 5 employees | 2,485 | 1,528 | 38.5% |
| Payroll generation: 50 employees | 22,268 | 11,808 | 47.0% |
| Payroll generation: 100 employees | 44,529 | 27,072 | 39.2% |

These reductions exceed the observed within-run ranges. The 100-employee after range was 26,750–27,611 ms versus 44,337–46,847 ms before; Attendance was 8,453–8,916 ms versus 12,642–13,066 ms. No measured service workload regressed.

Conditions: local Windows Node/tsx processes, direct Neon connection, owned disposable schemas on the pinned workpulse-batch0-recovery endpoint. Four alternating before/after pairs per workload; first pair excluded from timing medians, three warm samples retained. Synthetic payroll fixtures mix monthly/daily compensation and 31 calendar days of present, absent, incomplete and rest-day records. Attendance fixtures cover nine employee-days with schedule breaks and raw events. Setup, cleanup and comparison queries are outside the timed sections. No extra SQL was added solely for instrumentation.

Focused H3/H6/H8 fixture suites overlapped part of the run, including smaller payroll samples. The later 100-employee and Attendance samples did not overlap another benchmark, build or UI workload. External database load was not controlled. These are service benchmarks, not Next.js page timings or Vercel results. HTTP TTFB, browser navigation, Vercel cold starts and production workloads: **Not measured**.

Raw samples: service-samples.json; medians/ranges/conditions: summary.json. Frozen pre-change implementations in scripts/reference/batch3-*.ts provide the oracle; only their import paths were adjusted.

## 6. Transaction and concurrency results

The original monolithic H3 fixture reproduced P2028 in an isolated schema: the process failed after 6,266 ms while its default-timeout transaction ran setup plus repeated materializations/assertions. This occurred even with the reduced materialization reads. Evidence: historical-h3-timeout.json. It confirms this fixture's deadline problem, not the cause of an unavailable historical production trace.

The fixture was restructured into committed synthetic setup and bounded business/rollback transactions. The private-schema owner removes the schema afterward; it no longer disables immutable-history triggers to clean up rows. It requires a batch3_test_* schema and refuses the public schema.

The corrected H3 suite passed 39 assertions: concurrent identical events persist once; conflicting references roll back; simultaneous corrections commit one revision and reject the stale revision; simultaneous period evaluations complete with one projection per employee/day; event/projection rollback preserves the previous projection exactly; raw evidence is immutable; tenant-forged events are rejected; timezone/DST, incomplete attendance, zero grace, lateness, undertime, rest days and missing schedules retain their rules. All eight Attendance benchmark executions completed without P2028 and with full projection parity.

Retries are bounded and do not guarantee success under sustained contention, slow locks or arbitrary network stalls. The historical oversized fixture remains inherently incompatible with the default deadline if restored. Schedule creation and other long fixtures were not given broader timeouts.

## 7. Payroll calculation parity

All 12 payroll benchmark pairs (four at each of 5/50/100 employees) compared complete returned results and persisted amounts/snapshots. Only generated PayrollEntry IDs and volatile creation/update/calculatedAt timestamps were excluded. Employee, period, compensation, policy and leave-request identities remain part of the comparison. All passed. Repeated generation preserved existing entries byte-for-byte; partial-period compensation, missing required attendance and finalized-period rejection matched the oracle.

Seven additional checks passed: fractional Decimal deduction parameters; paid leave and daily/monthly rates; UNPAID and NO_PAYROLL_EFFECT treatments with actual-present-day basis; fixed-occurrence/absence deductions; deduction-exceeds-gross errors; multiple covering compensations; concurrent generation uniqueness; and foreign-tenant actor denial. These compare complete snapshots/results with the prior implementation. H6's 69-check integration suite also passed, including approved leave, policy dating, review/finalization, immutable finalized entries, historical payslips and ESS access rules. No calculation formula was edited.

## 8. Regression results

| Suite/check | Result | Evidence |
|---|---|---|
| H1 Employee Core | PASS, 22 assertions | core-ess-leave-payroll-tenancy.json |
| H2 Employment/Probation | PASS | core-ess-leave-payroll-tenancy.json |
| H3 Attendance | PASS, 39 assertions | h3-test-h3-attendance.json |
| H4/H7 ESS | PASS | core-ess-leave-payroll-tenancy.json |
| H5 Leave | PASS | core-ess-leave-payroll-tenancy.json |
| H6 Payroll/ESS payslips | PASS, 69 assertions; also rerun by regression wrapper | test-h6-payroll-foundation.json; core-ess-leave-payroll-tenancy.json |
| H8 Analytics | PASS, 44 assertions | test-h8-analytics.json |
| H10.1 | PASS, 85 checks; also rerun by regression wrapper | h10-1.json; core-ess-leave-payroll-tenancy.json |
| H10.2 | PASS, 59 checks | h10-2.json |
| H10 interface + alternating-tenant Dashboard | PASS, 23 interface checks | h10-interface.json |
| S1 tenant isolation | PASS | core-ess-leave-payroll-tenancy.json |
| Synthetic service benchmark parity | PASS, 25 assertions | test-batch3-services.json |
| Additional payroll policy/concurrency parity | PASS, 7 assertions | scenarios-test-batch3-services.json |

Core/ESS/Leave/Payroll/tenancy scripts were run through the existing H10.2 isolated-regression wrapper, which invokes their npm scripts and records each exit result. H3/H6/H8 and service-parity fixtures used newly migrated disposable batch3_test_* schemas; the owner dropped each schema in finally. No reset, seed or public application-record cleanup was used. Prisma P0001 entries in some successful test logs come from deliberate constraint/immutable-trigger rejection assertions, not unhandled runtime failures. The known failing monolithic H3 checkpoint is retained separately as historical-h3-timeout.json.

## 9. Build results

Prisma validation, TypeScript and local production webpack build passed; production build took 70,949 ms. Final TypeScript, ESLint on all nine changed/new TypeScript/CommonJS files, and git diff --check passed. Only test/documentation tooling changed after the successful production build; application source was unchanged.

## 10. Files modified

Application:

- src/features/attendance/service.ts
- src/features/payroll/service.ts
- src/features/payroll/generation-inputs.ts (new)

Validation/evidence:

- scripts/test-h3-attendance.ts — bounded isolated fixture, concurrency and rollback coverage
- scripts/test-batch3-services.ts — synthetic parity/scalability fixtures
- scripts/batch3-performance.cjs — pinned recovery-target/private-schema runner
- scripts/summarize-batch3-performance.cjs — offline sample summarizer
- scripts/reference/batch3-attendance.ts; batch3-payroll-service.ts — prior implementations
- docs/performance-audit/batch-3/* — sanitized results/report

The final read-only verification passed: 22 applied migrations, matching H10 checksums, no missing expected columns/enums, 16 enabled H10 triggers, and unchanged fingerprints for all 46 protected public tables. Evidence: data-preservation.json. These fingerprints compare the original protected column projections; the newly added H10 column is excluded from that historical baseline. No protected-table differences were found. The original .env SHA-256 still matches the pre-recovery baseline. Local test servers have stopped; completed runners removed their owned schemas in finally.

The original .env and Vercel configuration were not edited. No production connection, existing employee mutation, finalized-payroll mutation, historical migration edit, H10 behavior change or deployment was performed. Saved Batch 3 evidence was scanned for connection URLs/JWT patterns with zero matches.

## 11. Remaining bugs and performance concerns

- Generation still takes about 27 seconds for this 100-employee synthetic fixture. Individual input reads/writes remain sequential; converting this to cohort-wide snapshots or bulk writes needs a separate consistency/finalization/concurrency design.
- Large Attendance periods still perform one Serializable transaction per employee/day. This batch reduces round trips without expanding the atomic unit. Heavy contention can still exhaust serialization retries or the default deadline.
- The added parameterized SQL projections must evolve alongside future schema/calculation changes. Existing indexes were reused; no new index need was demonstrated.
- No additional application calculation or tenant-isolation bug has been confirmed by the completed checks. Encountered fixture failures—the original H3 long transaction, a missing synthetic event direction, and an unsupported fractional leave charge—were corrected in test code. The P2028 failure evidence is retained separately.
- The next task is system-wide bug fixing and end-to-end stability verification, including representative larger Attendance workloads, slow-network/lock injection, generation/finalization races, and deployment-environment measurements. No new feature work was started.

Stop after Batch 3. No Vercel deployment or production migration.

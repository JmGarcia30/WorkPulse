# Organization-specific probation policy

Implemented locally on top of the existing Leave and Hiring work. No commit, push, deployment, production connection/write, environment-file change, or .impeccable change was performed. Changes to Hiring are limited to probation terms, snapshots and conversion confirmation.

## Configuration and agreed terms

- HR/Admin opens Employees → Probation policy settings (`/dashboard/employees/probation-settings`). Authentication derives the organization; the save action also checks the actor's current database role. Caller-supplied organization IDs cannot select another tenant.
- Existing Organization and Offer models now have nullable JSONB fields `probationPolicy` and `probationPolicySnapshot`. Existing `Offer.probationPeriodMonths`/`probationaryTerms`, `ProbationRecord.policySnapshot`, renewal counters, dates and decision history are reused. No new policy table, historical backfill or period rewrite was introduced.
- General company configuration has separate Teaching/Non-Teaching settings: initial months, evaluation standards, whether documented evaluation is required, renewal count and months per renewal. Initial duration is 1–6 whole months; initial duration plus every allowed renewal must remain within six months. Setting both renewal fields to zero prohibits renewal. Standards are mandatory; unconfigured organizations cannot issue guessed probation terms.
- New offers snapshot policy and readable standards at creation. Draft edits and subsequent organization policy changes do not replace that agreed snapshot. Offer cards display the agreed probation terms.
- Conversion resolves the accepted offer's snapshot rather than current settings or job category. Company B Teaching roles do not require a SAGA school-year date. HR must confirm standards were communicated at engagement, and the signed contract execution date must be no later than the employment start date. Initial records store the agreed policy in the existing snapshot column.
- Legacy non-SAGA offers retain explicit agreed months/text if present and within the general ceiling, without inferred renewal rights. Missing, contradictory snapshot fields, or unsupported legacy durations block conversion for HR review; no signed offer is silently corrected.

## SAGA preservation

The actual organization is identified by its unique persisted `st-aloysius` slug, never its display name or employment category alone. SAGA cannot be edited through the generic settings action.

Teaching keeps exact contract school-year dates, two permitted renewals, the existing defensive three-year total limit, and the existing restriction on Faculty regularization in H2. Non-Teaching keeps six calendar months, no renewal, and the existing regularization path. Legacy SAGA snapshot text remains readable and unchanged. No existing employee, employment period, offer, renewal limit or historical policy was rewritten.

## Reviews and renewal

- Decisions read the employee's saved policy, not current company settings. Required evaluation must be explicitly confirmed and documented in remarks. General adverse decisions always require evaluation and legal-review confirmation.
- General renewals additionally require written employee consent before expiry, a decision on the agreed period end date, immediate succession, the agreed extension length, saved renewal count and total agreed/statutory cap. The UI offers regularization for general company Teaching roles and uses generic renewal labels.
- General overdue renewals/adverse decisions are blocked. The profile explains that continued service may confer statutory regular status and cannot be overridden by current settings. Unstructured legacy general policies do not acquire renewal rights from a category or organization setting.
- Existing atomic decision claims, serializable retries, effective employment records and audit history remain. General decision history additionally records evaluation, consent and legal-review confirmations; existing SAGA audit shape is preserved.

## Migration and recovery verification

Migration: `20261022000200_organization_probation_policy`.

Its only SQL adds nullable `Organization.probationPolicy` and `Offer.probationPolicySnapshot`, both JSONB, without defaults or data modifications. It was applied only on verified disposable branch `br-broad-forest-az55xwfe` / endpoint `ep-bitter-queen-azfwx70v`. Both recovery connections were checked against the saved mapping, distinct from the protected original endpoint, with matching migration histories/checksums.

A recovery-only scoped Prisma bundle included applied migrations plus this migration. The unrelated pending Candidate Access migration was deliberately excluded. Postflight confirms the probation migration is applied; Candidate Access alone remains pending on recovery. Existing-column fingerprints across all 50 tables match before/after migration. All 50 tables also match after each rolled-back test run.

Production has not received this new migration. A future authorized release must apply the reviewed migration before activating runtime code/Prisma Client that references these columns, through the normal full-checkout migration process after checking expected pending migrations.

## Tests and validation

- `node scripts/test-probation-organization-policy.cjs`: 11 scenario groups passed, covering configuration validation, actual SAGA protection, Company B offers, snapshot preservation across policy changes, conversion and idempotency, standards confirmation, evaluation/consent/timing checks, renewal limits, generic Teaching regularization, wrong-tenant access, current-role revocation and decision audit flags.
- `node scripts/test-probation-organization-policy.cjs h1`: all 22 existing H1 assertions passed.
- `node scripts/test-probation-organization-policy.cjs h2`: all 24 existing H2 assertions passed.
- Regression fixtures use explicit SAGA identity inside an outer rollback transaction. Existing fixture teardown is replaced by rollback, and H1's old stale-fixture cleanup is omitted. The original SAGA slug and every existing database row are restored. The frozen profile oracle remains unchanged; its assertion adapter accounts for the newly selected organization slug while continuing to compare all existing fields and all six tabs.
- H1/H2 operations are serialized within rollback fixtures. Their one-winner/idempotency assertions pass, but this run does not claim independently committed concurrency coverage.
- TypeScript `tsc --noEmit --incremental false`, changed-file ESLint with `--max-warnings 0`, Prisma Client generation, Prisma validation, and `git diff --check` passed. Pre-existing unused imports in touched components were removed to make targeted lint clean.
- No broad audit, full production build, hosted delivery test or deployment was run. Leave code and Hiring document/candidate credential/access-control code were not edited.

## Legal basis and limits

The general path conservatively enforces a six-month ceiling and communication of reasonable evaluation standards at engagement. Those constraints follow the general probation rule and standards requirement discussed in [G.R. No. 182072](https://lawphil.net/judjuris/juri2013/jun2013/gr_182072_2013.html). SAGA's existing academic path remains separate; academic probation and school-year renewal distinctions are discussed in [G.R. No. 224319](https://lawphil.net/judjuris/juri2017/nov2017/gr_224319_2017.html).

This implementation does not expose an arbitrary longer-period override. Exceptional extensions are fact-specific: [G.R. No. 221356](https://www.lawphil.net/judjuris/juri2018/mar2018/gr_221356_2018.html) distinguishes narrow recognized extensions from the general rule, and [Mariwasa](https://lawphil.net/judjuris/juri1989/jan1989/gr_74246_1989.html) addresses a voluntarily agreed opportunity to improve performance. The settings UI does not attempt to determine those exceptions. Other academic regimes, apprenticeship and arrangements exceeding the general ceiling require separate reviewed support.

The application records HR attestations and remarks; it does not verify the underlying written consent, employee communication, assessment evidence or complete dismissal procedure. Unsupported or overdue adverse cases require separate legal handling. Existing questionable legacy contracts are preserved and flagged through guarded workflows rather than automatically rewritten. Statutory regularization is not defeated by the absence of an application decision, and this sprint does not add automatic database regularization.

UI changes were validated by types/lint and service integration; no complete browser interaction test was performed. Work remains uncommitted for review.
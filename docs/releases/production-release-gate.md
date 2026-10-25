# Production release gate: NO-GO

Checked commit `5be19f4` on `employee-ui-design`, 2026-10-25T13:31:40.779Z.
Public https://work-pulse-omega.vercel.app/ returned HTTP 200 with Vercel hosting headers. Homepage availability is not proof of migration readiness.

## Database identity and limits

The explicitly selected local .env production-candidate connection reaches database `neondb`, schema `public`, Neon branch `br-hidden-violet-azjl3vam`, endpoint `ep-weathered-mouse-azpx765h`. It is distinct from the recovered development endpoint. Both default and transaction read-only settings were on; only migration/schema metadata was read, not employee records.

**This target has NOT been independently matched to the actual Vercel Production environment.** There is no linked Vercel project or Vercel/Neon provider API access available. Production branch mapping, environment scope/integration overrides, root domain/public origin, stable signing/encryption keys, and build-command overrides remain unverified.

The first diagnostic connection rejected an audit-only startup timeout parameter on the Neon pooler. After the exact unsupported parameter was identified, it was removed from the temporary audit harness. The corrected read-only query succeeded. No application, environment/recovery file or persistent database configuration was changed. No indefinite retry loop was used.

## Exact migration comparison for the connected target

**24 applied / 36 committed; 12 pending.** All 24 applied checksums match the committed SQL (allowing line-ending normalization); no unexpected applied migrations, checksum mismatches or unresolved failed entries. One historical H5 entry was rolled back and excluded from the applied count.

Applied:

- `20260810182207_sprint1_initial`
- `20260810191746_sprint1_5_tenant_portals`
- `20260811133650_expand_application_status_enum`
- `20260821112801_sprint2_2_interview_management`
- `20260822133153_sprint2_3_assessments_offers`
- `20260825052913_sprint2_4_onboarding`
- `20260831112506_add_parsed_resume`
- `20260906180000_h1_employee_core`
- `20260907120000_h2_employment_probation`
- `20260908180503_h3_attendance_foundation`
- `20260911120000_h4_employee_self_service`
- `20260914160000_h5_leave_management`
- `20260914173000_h5_leave_integrity_followup`
- `20260915120000_h5_leave_workflow_simplification`
- `20260917120000_h5_final_leave_simplification`
- `20260918120000_s1_tenant_branding`
- `20260924190000_h6_1_payroll_foundation`
- `20260928120000_h6_2_simple_payroll_calculation`
- `20260928180000_h6_2_5_payroll_policy`
- `20260928210000_h6_3_payroll_finalization`
- `20261017090000_h10_1_exit_clearance`
- `20261017120000_h10_2_final_separation`
- `20261021000100_candidate_access`
- `20261022000100_hiring_document_policy`

Pending in chronological order:

| Migration | Compatibility / data considerations |
| --- | --- |
| `20261022000200_organization_probation_policy` | Nullable Organization/Offer policy columns; no historical policy backfill. |
| `20261022000300_payroll_statutory_integration` | SEMI_MONTHLY enum addition; five statutory tables; foreign keys and unique indexes, including two on existing payroll tables. Enum rollback is not automatic. Reviewed statutory/tax-opening inputs remain a separate data prerequisite. |
| `20261023000100_platform_administration` | New administrator/session/throttle tables. Requires separately provisioned authorized administrator for operational use. |
| `20261023000200_organization_onboarding` | Organization contact column, invitation/audit tables and tenant foreign keys; no automatic classification/backfill of existing tenants. |
| `20261023000300_public_company_registration` | New verification registration table. Does not enable arbitrary workspace paths on a temporary Vercel hostname. |
| `20261023000400_organization_gmail_integration` | New Gmail connection/OAuth-attempt tables. Existing production encrypted credentials are not manufactured. |
| `20261024000100_saga_recruitment_sender` | Adds testedAt and recruitmentGmailActive default false, preserving explicit SAGA sender activation gate. |
| `20261024000200_hr_email_delivery` | New email delivery audit table and uniqueness constraints; no historical messages replayed. |
| `20261024000300_organization_resignation_policy` | Nullable resignation policy column; no historical snapshot rewrite. |
| `20261024000400_employee_final_pay` | Nullable final-pay policy plus new final-pay/payment/audit tables and immutable state/payment triggers; no historical final pay computed/backfilled. |
| `20261024000500_ess_resignation_notice` | Adds submissionSource NOT NULL DEFAULT HR and nullable notice/acknowledgment fields to existing separation cases; validates new CHECK/FK constraints and installs immutable employee-notice trigger. |
| `20261025000100_rfid_attendance_phase1` | Four new RFID tables, tenant keys, active-card partial uniqueness and immutable audits; no existing attendance rewritten. |

The pending set exactly matches the twelve migration files added relative to local main. No pending SQL contains explicit DROP TABLE/COLUMN, TRUNCATE, DELETE, UPDATE or INSERT statements against historical records. This does not make the release risk-free: ALTER TABLE, ordinary indexes and validated foreign keys/CHECKs require DDL locks, and enum removal is not an ordinary rollback. The composite unique indexes on existing PayrollPeriod/PayrollEntry include the primary-key ID, so they do not introduce a new business-level deduplication requirement.

The ESS notice migration gives existing cases source HR with null acknowledgment fields; its new checks must validate on the actual production schema. Final-pay/RFID audit triggers intentionally restrict subsequent modification. Default-based provenance and new policy interpretation still require business review; the migrations do not establish approved financial rates or calculate historical amounts.

**The release code is incompatible with the connected pre-migration schema.** Authentication includes Organization scalars added by these migrations, and the new platform, payroll, email, final-pay and RFID services query missing tables/columns. Do not deploy code before separately approved schema preparation. Integrated payroll also needs reviewed statutory bases and opening history after the new tables exist; migration success alone does not make payroll operational.

## Exact release blockers

1. Twelve required migrations are missing on the connected target. The actual Vercel Production target is still unverified; its ledger must be checked once its identity is confirmed.
2. **No verified production backup/restore point.** Existing evidence concerns a development checkpoint or recreation of disposable branches, not an available production restore point. Provider retention, latest recoverable timestamp, backup accessibility and restore procedure cannot be established from this SQL connection. Obtain provider-side evidence and a restoration rehearsal before approving DDL.
3. **Unverified Vercel Production configuration and automatic deployment gate.** Confirm the intended project/alias, main branch mapping, effective Production database endpoint and any Neon integration overrides. Preserve existing production signing keys; do not copy recovery/Preview secrets or overwrite production variables.
4. **Unresolved authentication security findings:** staff password login lacks persistent throttling, and logout/password changes do not revoke a copied, otherwise valid seven-day staff JWT. Require correction or explicit security-owner risk acceptance; no external WAF mitigation was verified. Current role/membership/tenant checks and verified candidate access are already implemented and previously tested; do not treat superseded ID-only candidate findings as still unfixed.
5. After schema preparation, reviewed payroll statutory/opening inputs and any intended financial policies must be configured/approved before enabling operational integrated payroll. No deduction rates should be invented. Other optional email/platform/new-workspace journeys retain their separately documented setup gates.

The latest commit adds previously excluded recovery/diagnostic artifacts. Screening it against known local secret values, credential-bearing database URLs and private-key patterns found none. This is not an audit of all repository history or a reason to publish unnecessary operational/employee identifiers; review that commit's broad scope before merging.

## Safest release order (future actions require separate authorization)

1. Confirm the actual Vercel Production target/configuration and hold automatic production promotion before any merge/push that could deploy.
2. Verify an accessible production restore point, retention and restoration procedure; rehearse the exact pending migration/code bundle on a separate restored production-like copy. Resolve security findings or obtain explicit recorded risk acceptance.
3. Obtain approval for the exact production schema plan and maintenance/lock window. Back up first, then apply only the confirmed pending schema migrations through a controlled production operation; none was applied by this audit.
4. Recheck all 36 migration names/checksums, constraints/triggers and protected historical records. Verify operational payroll/sender/platform setup for the features being enabled.
5. Only after those gates pass, approve merging the reviewed commit into main and promote the matching deployment. Smoke-test SAGA login/logout, tenant/role rejection, the intended RFID flow and payroll setup behavior. Keep an explicit code/restore rollback plan; do not assume additive enum/trigger changes can be trivially undone.

No migrations, record updates, backup creation/modification, environment/configuration writes, merges, pushes, deployments or broad tests were performed. Local evidence files only were added.

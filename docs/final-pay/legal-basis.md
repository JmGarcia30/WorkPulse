# Final-pay rules and supported review scope

Verified against the following authoritative Philippine sources during this implementation (24 October 2026). No inferred statutory separation-pay multiplier or automatic final tax calculation is enabled.

## Release deadline

[DOLE Labor Advisory 06-2020 issuance page](https://dole.gov.ph/news/labor-advisory-no-06-20-guidelines-on-the-payment-of-final-pay-and-issuance-of-certificate-of-emplo/) and [DOLE's published clarification on clearance and final pay](https://www.foi.gov.ph/agencies/dole/labor-code-on-clearance-and-final-pay-release-dole-181332223179/) establish release within 30 days from separation/termination, subject to more favorable company policy or individual/collective agreement. The clarification places clearance within that release period, rather than restarting it after clearance.

The original issuance PDF endpoint was inaccessible during this inspection; the deadline is independently supported by DOLE's clarification above and [its September 2026 response](https://query.dole.gov.ph/tracker/DOLE2609271436181877). Application: calendar-date addition in the organization timezone, anchored to the existing Exit effective separation date (the first day outside employment), not execution, approval or clearance time. HR can set shorter organization terms or shorten an individual case deadline with an evidence reference. Favorable deadlines cannot be extended through these forms. Unfinalized cases must adopt a newer shorter policy before approval; finalized records retain their approved deadline/basis rather than retrospectively changing historical payment timeliness. HR must assess applicability of later agreements externally. Partial payment does not erase overdue balances. Fixed-date/business-day agreements require an equally or more favorable calendar-day deadline and documented review.

## Proportionate 13th-month pay

[DOLE's December 2025 guidance](https://dole.gov.ph/no-delays-allowed-on-13th-month-pay-dole1/) describes private-sector rank-and-file coverage, at least one month of calendar-year service, the basic-earned/12 minimum and the December 24 deadline. Non-basic benefits are excluded unless applicable policy/agreement integrates them. WorkPulse calculates verified basic earned in the relevant calendar year divided by 12, less explicitly verified prior 13th-month payments. It also displays the earlier December 24/final-pay deadline for review. More favorable benefits must be included as reviewed additions, with references. Partial payments are not automatically allocated to individual components.

## Leave conversion

[Supreme Court discussion of accrued service incentive leave](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/14/62898) supports commutation of qualifying accrued unused SIL at separation. This does not mean every leave type/balance is convertible. WorkPulse multiplies HR-verified convertible days (up to four decimal places) by a reviewed daily conversion rate. Eligibility, unused cycles, prior conversions, applicable exceptions and company/CBA rules require review; it never assumes every balance is cashable.

## Separation grounds and deductions

[Supreme Court: Italkarat v. Gerasmio](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/66695) explains that voluntary resignation generally does not carry separation pay, subject to contractual/company-practice exceptions. [JPL Marketing](https://lawphil.net/judjuris/juri2005/jul2005/gr_151966_2005.html) discusses separation pay for specified authorized causes. A `TERMINATION` enum alone does not establish the qualifying cause. WorkPulse requires a reviewed amount and specific legal/contractual computation evidence, or an explicit non-applicability finding; neither resignation nor termination generates an entitlement by default.

[Supreme Court: Labadan v. Forest Hills Academy](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/1/48415) discusses wage deductions under Labor Code Article 113 and implementing rules. Clearance obligations never become deductions automatically. HR must document the lawful basis and itemize approved deductions in the evidence; missing evidence blocks review.

## Data reliability and unsupported automation

- Existing payroll/compensation, attendance summaries, recorded leave balances and employment dates are displayed and snapshotted as review evidence. Payroll finalization does not prove disbursement. Payroll base/gross values do not establish the complete eligible basic-earned basis after absences, prior employers, inclusions or benefit practices. No unsupported payment or accrual inference is made.
- Salary is verified gross earned for the unsettled coverage minus verified gross-equivalent salary already settled. HR must avoid duplicating previously settled deductions. All prior-payment fields require an explicit amount, including an evidence-backed zero.
- PHP amounts use the existing payroll `Prisma.Decimal` and monetary validation infrastructure. Results round to centavos using `ROUND_HALF_UP`; floating-point arithmetic is not used for money. Negative recoveries/overpaid components are flagged for external resolution instead of silently clamping to zero.
- Final tax annualization, taxability/exemptions, refunds, contribution adjustments, retirement awards, disputed awards, currency conversion, managerial/government/special-sector coverage and unverified statutory separation-pay factors are not automatically calculated. Qualified external review is required; verified additions/deductions and references can be recorded. Missing/unsupported information stays unreviewed and prevents approval.
- Multi-year arrears and more favorable annual-floor/CBA benefits require external reconciliation and reviewed additions; do not mix them into the single-calendar-year basic-earned field.
- Approved financial values, source evidence, receipts and audits are immutable. Payment recording does not initiate transfers. Automated bank disbursement and payment correction/reversal workflows are not provided in Phase 2.

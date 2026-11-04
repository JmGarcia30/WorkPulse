# November 2026 rule review

Reviewed November 5, 2026, Asia/Singapore; source capture began November 4 UTC. This is an ordinary private-employee payroll review, not approval for every Philippine compensation arrangement.

## What the old date meant

`BIR_VERIFIED_ON = '2026-10-22'` was used both as the review timestamp and as the last permitted payment/benefit date. It was a WorkPulse verification boundary, not a BIR expiry date. The statutory module separately stopped contribution months after October. Extending only the BIR guard would therefore still leave November generation blocked.

The revised code separates **reviewed on November 5** from **bounded payment coverage through November 30**. Ordinary statutory contribution coverage is also bounded to November. The tables, rates, exemptions and monetary algorithms are unchanged. December and 2027 remain blocked. This horizon relies on the currently published rules and is not a guarantee against an intervening issuance; a new applicable issuance requires another review before payment.

## Primary evidence and applicable rules

1. [BIR RR 11-2018, Annex E](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf) states that its revised withholding tables apply from January 2023 onward. Monthly and semimonthly columns have distinct printed thresholds. [Local PDF](annex-e.pdf).
2. [RR 11-2018](https://bir-cdn.bir.gov.ph/local/pdf/RR%20No.%2011-2018.pdf), section 2.79(B), requires the appropriate payment-frequency table, distinguishes regular/supplementary compensation and provides exceptional and annualized methods. The current implementation retains its restricted ordinary method. Annualization/final-pay/cumulative cases require separate handling. [Local PDF](rr11-2018.pdf).
3. [BIR's official calculator source](https://web-services.bir.gov.ph/tax_calculator/js/wt_calculator.js), functions `getMonthlyZero`, `getSemiMonthlyZero`, and `calculateForm`, uses the corresponding table and rounds each payment's tax to two decimal places. Relevant source lines are approximately 804–880 and 972–1012. [Downloaded source](official-wt-calculator.js). Its existing benefit UI is not treated as the authority for the later RR 29-2025 ceilings.
4. [RR 29-2025 full regulation](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025.pdf), section 1, amends the de minimis provisions. Section 3 sets effectivity fifteen days after publication in the Official Gazette or BIR website, whichever occurs first. The [BIR 2025 regulations index](https://www.bir.gov.ph/2025-Revenue-Regulations) records website posting on December 22, 2025. That documented publication supports January 6, 2026 effectivity; no earlier official publication was identified in this review. The publication date is distinct from signature/received stamps. [Full PDF](rr29-2025.pdf), [official digest](rr29-2025-digest.pdf), [page 1](rr29-page-1.png), [page 2 including effectivity](rr29-page-2.png), [rendered index](bir-2025-regulations.txt). Both scanned regulation pages were visually inspected.
5. The rendered [2026 regulations index](https://www.bir.gov.ph/2026-Revenue-Regulations) listed RR 1–7, with latest issue October 13; the [2026 circulars index](https://www.bir.gov.ph/2026-Revenue-Memorandum-Circulars) listed through RMC 115, October 26. No listed issuance superseded the ordinary compensation tables or the supported RR 29-2025 limits. RMC 112 concerns invoice creditable withholding, not this employee-compensation calculation. Saved rendered evidence: [regulations](bir-2026-regulations.txt), [circulars](bir-2026-circulars.txt). This is the observed publication inventory, not a claim to know future issuances.

## RR 29-2025 scope

| Benefit described by the regulation | Revised limit / condition | WorkPulse status |
|---|---|---|
| Private-employee unused vacation leave monetization | 12 days per year | Unsupported category; reviewed separate treatment required |
| Government vacation/sick leave monetization | Government-employee provision | Outside supported private-employee profile |
| Dependent medical cash allowance | PHP 2,000 per semester / PHP 333 per month | Unsupported category |
| Rice benefit | PHP 2,500 monthly or qualifying rice equivalent | Supported cash rice classification, with evidence/history |
| Clothing/uniform benefit | PHP 8,000 annually | Supported cash classification, with evidence/history |
| Medical assistance | PHP 12,000 annually | Unsupported category |
| Laundry benefit | PHP 400 monthly | Supported cash classification, with evidence/history |
| Achievement awards | PHP 12,000 annually, qualifying written nondiscriminatory plan | Unsupported category |
| Christmas/major-anniversary gifts | PHP 6,000 annually | Unsupported category |
| Overtime/night-shift meals | 30% of regional basic minimum wage, per day | Unsupported category; overtime wages are a different classification |
| Combined CBA/productivity scheme benefits | PHP 12,000 annually | Unsupported category; cannot assume the general other-benefits pool applies instead |

No unsupported category was newly mapped into a generic tax-free allowance. The supported rice/clothing/laundry caps already matched RR 29-2025. Their time-based usage remains persisted, so a second cutoff cannot repeat an exemption. The separate qualifying 13th-month/other-benefit pool remains PHP 90,000 under RR 11-2018 section 2.78.1(B)(11); RR 29-2025 does not replace it with the smaller category-specific limits above. Classification and complete verified benefit history remain mandatory.

## Exact explanation of the PHP 0.14 difference

| Item | Monthly | Each semimonthly payment | Two semimonthly payments |
|---|---:|---:|---:|
| Gross | 35,000.00 | 17,500.00 | 35,000.00 |
| Employee SSS + PhilHealth + Pag-IBIG | 2,825.00 | 1,412.50 | 2,825.00 |
| Taxable regular compensation | 32,175.00 | 16,087.50 | 32,175.00 |
| Printed 15% bracket threshold | 20,833.00 | 10,417.00 | 20,834.00 |
| Exact unrounded withholding | 1,701.300 | 850.575 | 1,701.150 |
| Posted withholding | 1,701.30 | 850.58 | 1,701.16 |
| Total posted employee deductions | 4,526.30 | 2,263.08 | 4,526.16 |

The two printed cutoff thresholds exceed the monthly threshold by PHP 1.00. At 15%, that produces PHP 0.15 less tax before rounding. Each cutoff rounds 850.575 to 850.58; two half-cent rounding increments add PHP 0.01, leaving **0.15 − 0.01 = PHP 0.14**. Contributions reconcile exactly; none of this difference is an employer share or duplicate deduction.

The official calculator source was executed separately in a test VM and returned 1,701.30 and 850.58. Independent expected constants were also checked against the Decimal implementation. No tax true-up was forced into the second contribution cutoff: the frequency table differences are periodic withholding, not a different final annual income-tax liability. The separate year-end/final-pay annualization obligations remain unimplemented and blocked when applicable.

The inspected RR/Annex text did not supply a separate general half-cent rounding clause. The positive-tax centavo convention is supported by the official calculator implementation; it is not presented here as a verbatim regulatory rounding provision.

For illustration only, twelve unchanged months of the same taxable regular compensation give annual taxable pay of PHP 386,100 and annual tax of `(386,100 − 250,000) × 15% = 20,415.00`. Twelve monthly withholdings total 20,415.60; 24 cutoff withholdings total 20,413.92. The resulting 0.60 excess / 1.08 deficiency belong in the required annual reconciliation. This manual check does not implement or authorize the currently unsupported annualization workflow. Annual-return whole-peso instructions were not substituted for per-payroll centavo rounding.

## Related ordinary contribution window

The existing contribution-month guard also required an evidence-backed November review. No contribution rate was changed:

- [SSS current contribution guidance](https://www.sss.gov.ph/pay-contribution/) and [circular index](https://www.sss.gov.ph/sss-circulars/) continue to identify Circular 2024-006 for business employers/employees. Its table gives employee PHP 1,750, employer PHP 3,500 and employer-only EC PHP 30 at the tested maximum credit. Later listed circulars do not replace that schedule.
- [PhilHealth's 2026 announcement reported by PIA](https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/) confirms 5%, PHP 10,000 floor/PHP 100,000 ceiling, with equal employee/employer sharing for employed members. [2026 circulars](https://www.philhealth.gov.ph/circulars/2026/) and [advisories](https://www.philhealth.gov.ph/advisories/2026/) were inspected. Special coverage/subsidy arrangements still require reviewed coverage; no new exemption was inferred.
- [Official ONAR-filed Pag-IBIG Circular 460](https://naro.law.upd.edu.ph/issuances/3217) supplies the continuing PHP 10,000 fund-salary ceiling and contribution schedule; [local official PDF](pagibig-460.pdf). A [September 2026 government report of the Pag-IBIG branch's guidance](https://pia.gov.ph/features/securing-tomorrow-pag-ibig-fund-urges-ilocos-sur-workers-to-save-plan-for-future) corroborates ongoing PHP 200 regular monthly savings, but does not replace the circular's employee/employer rules. The public Pag-IBIG site presented a CAPTCHA, so the registered official copy was used. Unresolved fractional-centavo cases remain blocked.

## Independent regression results

[Focused rule results](rule-tests.json) record expected versus actual November basic, first/second cutoff, taxable bonus, RR29 caps with an exhausted annual pool, and 13th-month pool exhaustion. Tests retain rejection of unknown RR29 classifications, incomplete histories, annualization and dates beyond the bounded window. The official calculator reference uses JavaScript only in the independent test harness; application money remains `Prisma.Decimal`.

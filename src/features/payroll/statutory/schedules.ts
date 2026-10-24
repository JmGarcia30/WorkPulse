/** Government schedules only. Organization payroll policies cannot override these. */
export const STATUTORY_VERIFIED_THROUGH = '2026-10';
export const STATUTORY_VERIFIED_ON = '2026-10-22';

export const STATUTORY_SCHEDULES = Object.freeze({
  SSS: Object.freeze({
    id: 'SSS-BUSINESS-2025-01', effectiveFrom: '2025-01', verifiedThrough: STATUTORY_VERIFIED_THROUGH,
    sourceUrls: Object.freeze([
      'https://www.sss.gov.ph/wp-content/uploads/2024/12/CI-2024-006-Publication.pdf',
      'https://www.sss.gov.ph/wp-content/uploads/2024/12/Cir-2024-006-Employers-scaled.jpg',
      'https://www.sss.gov.ph/pay-contribution/',
    ]),
    rounding: 'EXACT_PUBLISHED_TABLE',
  }),
  PHILHEALTH: Object.freeze({
    id: 'PHILHEALTH-2025-01', effectiveFrom: '2025-01', verifiedThrough: STATUTORY_VERIFIED_THROUGH,
    sourceUrls: Object.freeze([
      'https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf',
      'https://www.philhealth.gov.ph/circulars/2020/circ2020-0005.pdf',
      'https://www.philhealth.gov.ph/news/2018/sample_compu.html',
      'https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/',
    ]),
    rounding: 'TOTAL_HALF_UP_CENTAVO_EMPLOYER_BEARS_ODD_CENTAVO',
  }),
  PAGIBIG: Object.freeze({
    id: 'PAGIBIG-460-2024-02', effectiveFrom: '2024-02', verifiedThrough: STATUTORY_VERIFIED_THROUGH,
    sourceUrls: Object.freeze([
      'https://naro.law.upd.edu.ph/issuances/3217',
      'https://naro.law.upd.edu.ph/storage/01JQWKTTA92H57M9EWV31W8F1D.pdf',
    ]),
    rounding: 'EXACT_CENTAVOS_ONLY_PENDING_AGENCY_ROUNDING_CONFIRMATION',
  }),
});

// Compact encoding of every row in Circular 2024-006, not a percentage of actual pay.
// Lower bounds are inclusive; upper bounds exclusive. First/last rows are open-ended.
export const SSS_2025_BRACKETS = Object.freeze(Array.from({ length: 61 }, (_, index) => {
  const msc = 5000 + index * 500;
  return Object.freeze({
    lowerInclusive: index === 0 ? '0' : String(msc - 250),
    upperExclusive: index === 60 ? null : String(msc + 250),
    monthlySalaryCredit: String(msc),
    regularSalaryCredit: String(Math.min(msc, 20000)),
    providentSalaryCredit: String(Math.max(msc - 20000, 0)),
    employeeRegular: String(Math.min(msc, 20000) / 20),
    employerRegular: String(Math.min(msc, 20000) / 10),
    employeeProvident: String(Math.max(msc - 20000, 0) / 20),
    employerProvident: String(Math.max(msc - 20000, 0) / 10),
    employerEc: msc < 15000 ? '10' : '30',
  });
}));

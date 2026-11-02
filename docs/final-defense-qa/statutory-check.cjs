require('tsx/cjs');
const assert=require('node:assert/strict');
const {calculateSss,calculatePhilHealth,calculatePagIbig}=require('../../src/features/payroll/statutory/index.ts');
const {assessBirTable}=require('../../src/features/payroll/bir/index.ts');
const common={currency:'PHP',arrangement:'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH',coverage:{status:'MANDATORY'}};
const cases=[];
for(const [agency,fn,basis,ee,er,ec] of [['SSS',calculateSss,'monthlyCompensation','1750.00','3500.00','30.00'],['PHILHEALTH',calculatePhilHealth,'monthlyBasicSalary','875.00','875.00','0.00'],['PAGIBIG',calculatePagIbig,'monthlyFundSalary','200.00','200.00','0.00']]) {
  const r=fn({...common,contributionMonth:'2026-09',[basis]:'35000'});
  assert.equal(r.employee.toFixed(2),ee);assert.equal(r.employer.toFixed(2),er);assert.equal(r.employerOnly.toFixed(2),ec);
  cases.push({id:'PAY-008-'+agency+'-oracle',status:'PASS',month:'2026-09',basis:'35000.00',employee:ee,employer:er,employerOnly:ec});
  try {fn({...common,contributionMonth:'2026-11',[basis]:'35000'});cases.push({id:'PAY-009-'+agency+'-current',status:'FAIL',unexpected:'calculated beyond verification coverage'});} catch(e) {cases.push({id:'PAY-009-'+agency+'-current',status:'BLOCKED',guardWorking:true,errorCode:e.code,message:e.message});}
}
for(const [frequency,taxable,expected] of [['MONTHLY','32175','1701.30'],['SEMI_MONTHLY','16087.50','850.58']]) {
  const r=assessBirTable({payDate:'2026-09-30',frequency,taxableCompensation:taxable});
  assert.equal(r.withholdingTax.toFixed(2),expected);
  cases.push({id:'PAY-008-BIR-'+frequency+'-oracle',status:'PASS',payDate:'2026-09-30',taxable,expected});
}
for(const payDate of ['2026-10-23','2026-10-31','2026-11-02','2026-11-15']) {
  try {assessBirTable({payDate,frequency:'MONTHLY',taxableCompensation:'32175'});cases.push({id:'PAY-009-BIR-'+payDate,status:'FAIL'});}catch(e){cases.push({id:'PAY-009-BIR-'+payDate,status:'BLOCKED',guardWorking:true,errorCode:e.code,message:e.message});}
}
require('./qa-runner.cjs').save('statutory-independent',{capturedAt:new Date().toISOString(),cases});console.log(JSON.stringify(cases,null,2));

import assert from 'node:assert/strict';
import { PrismaClient, Role } from '@prisma/client';
import { organization, employee, period, setup } from './test-payroll-integration';
import { generatePayroll } from '../src/features/payroll/service';
import { movePayrollPeriodToReview, finalizePayrollPeriod } from '../src/features/payroll/review';
import { listFinalizedPayslipsForEmployee } from '../src/features/payroll/payslip';
import { resolveEmployeeSelfContext } from '../src/features/employee-self-service/access';
assert.match(new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? '', /^batch3_test_[a-f0-9]{24}$/);
const db = new PrismaClient({ log: [] });
const rollback=Error('ROLE_PAYSLIP_FIXTURE_ROLLBACK');
async function main(){
  try { await db.$transaction(async tx=>{
    const scope=await organization(tx),person=await employee(tx,scope),p=await period(tx,scope);
    await setup(tx,scope,person,p.id);
    await generatePayroll({...scope,payrollPeriodId:p.id},tx);
    await movePayrollPeriodToReview({...scope,payrollPeriodId:p.id},tx);
    await finalizePayrollPeriod({...scope,payrollPeriodId:p.id,confirmation:'FINALIZE'},tx);
    const user=await tx.user.create({data:{organizationId:scope.organizationId,name:'Role payslip fixture',email:`role-${person.id}@fixture.invalid`,role:'EMPLOYEE'}});
    await tx.employeeAccount.create({data:{organizationId:scope.organizationId,employeeId:person.id,userId:user.id,status:'ACTIVE',activatedAt:new Date(),createdById:scope.actorUserId}});
    for(const role of [Role.EMPLOYEE,Role.HR_ADMIN,Role.FINANCE_OFFICER,Role.ORGANIZATION_HEAD]){
      await tx.user.update({where:{id:user.id},data:{role}});
      const context=await resolveEmployeeSelfContext({userId:user.id,organizationId:scope.organizationId,name:user.name,email:user.email,role},{organizationId:scope.organizationId},tx);
      assert.equal(context.employee.id,person.id);
      assert.equal((await listFinalizedPayslipsForEmployee({organizationId:scope.organizationId,userId:user.id},tx)).length,1);
      await assert.rejects(()=>listFinalizedPayslipsForEmployee({organizationId:scope.organizationId,userId:scope.actorUserId},tx));
      console.log('PASS',role,'personal ESS and own finalized payslip; unlinked staff rejected');
    }
    throw rollback;
  },{timeout:120000});}catch(error){if(error!==rollback)throw error;}
}
main().catch(error=>{console.error('ROLE_PAYSLIP_FAILURE',error.code??error.name,String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));process.exitCode=1;}).finally(()=>db.$disconnect());

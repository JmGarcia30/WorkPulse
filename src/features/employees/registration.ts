import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { employeeRegistrationSchema } from './registration-schema';
import { createEmployeeWithEmployment } from './records';
import { parseInstitutionalDate, resolveInitialProbationTerms } from './domain';
import { resolveOfferProbationPolicy } from './probation-policy';
import { createEmployeeInvitation } from '@/features/employee-self-service/activation';
import { assertEmployeeAccountManager, provisionEmployeeAccountInTransaction } from '@/features/employee-self-service/provisioning';
import { deliverEmployeeInvitation } from '@/features/employee-self-service/accounts';

export async function registerExistingEmployee(db: PrismaClient, actor: { organizationId: string; userId: string }, raw: unknown) {
  const input = employeeRegistrationSchema.parse(raw);
  const invitation = createEmployeeInvitation();
  const fingerprint = createHash('sha256').update(JSON.stringify({ ...input, actorUserId:actor.userId })).digest('hex');
  const result = await db.$transaction(async tx => {
    await assertEmployeeAccountManager(tx,{ organizationId:actor.organizationId, actorUserId:actor.userId, targetRole:input.role });
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`employee-registration:${actor.organizationId}`},0))::text`;
    const replay = await tx.employee.findUnique({ where: { registrationKey:input.registrationKey }, include:{ employeeAccount:{ include:{ audits:{ where:{ action:'EMPLOYEE_LINKED',details:{ path:['source'],equals:'DIRECT_REGISTRATION' } }, take:1 } } } } });
    if (replay) {
      const audit = replay.employeeAccount?.audits[0]?.details;
      if (replay.organizationId !== actor.organizationId || !audit || typeof audit !== 'object' || Array.isArray(audit) || audit.registrationFingerprint !== fingerprint) throw new Error('This registration key has already been used. Reload the form.');
      return { employeeId:replay.id, idempotent:true, invitation:null };
    }
    if (await tx.employee.findFirst({ where: { organizationId:actor.organizationId, OR:[{ employeeNumber:{ equals:input.employeeNumber,mode:'insensitive' } },{ email:{ equals:input.email,mode:'insensitive' } }] }, select:{ id:true } })) {
      throw new Error('An employee with this number or email already exists in your organization.');
    }
    const organization = await tx.organization.findUniqueOrThrow({ where:{ id:actor.organizationId } });
    let probation;
    if (input.employmentStatus === 'PROBATIONARY') {
      if (!input.probationStandardsConfirmed) throw new Error('Confirm the existing agreed probation standards and contract before registering probationary employment.');
      const policy = resolveOfferProbationPolicy(organization,input.employmentCategory);
      probation = resolveInitialProbationTerms({ category:input.employmentCategory,startDate:input.startDate,
        teachingExpectedEndAt:input.probationEndDate ? parseInstitutionalDate(input.probationEndDate,'Probation end date') : null,
        organizationSlug:organization.slug,policy });
    }
    const { employee, employmentRecord } = await createEmployeeWithEmployment(tx,{
      employee:{ organizationId:actor.organizationId,registrationKey:input.registrationKey,employeeNumber:input.employeeNumber,
        firstName:input.firstName,lastName:input.lastName,email:input.email,phone:input.phone,employeeStatus:input.employeeStatus,createdById:actor.userId },
      employment:{ jobTitle:input.jobTitle,department:input.department,employmentCategory:input.employmentCategory,employmentType:input.employmentType,
        hireDate:input.startDate,startDate:input.startDate,effectiveFrom:input.startDate,employmentStatus:input.employmentStatus,
        salary:new Prisma.Decimal(input.salary),payFrequency:input.payFrequency,createdById:actor.userId },
    });
    if (probation) await tx.probationRecord.create({ data:{ employeeId:employee.id,employmentRecordId:employmentRecord.id,category:input.employmentCategory,
      startedAt:input.startDate,expectedEndAt:probation.expectedEndAt,renewalCount:probation.renewalCount,maxRenewals:probation.maxRenewals,policySnapshot:probation.policySnapshot } });
    await tx.employeeStatusHistory.create({ data:{ employeeId:employee.id,toStatus:input.employeeStatus,changedById:actor.userId,reason:`Direct existing-employee registration: ${input.registrationReason}` } });
    const account = await provisionEmployeeAccountInTransaction(tx,{
      organizationId:actor.organizationId,employeeId:employee.id,actorUserId:actor.userId,role:input.role,
      existingUserId:input.existingUserId || undefined,allowInactive:true,invitation,
    });
    // Append a separate immutable registration snapshot; no activation bearer is stored.
    await tx.employeeAccountAudit.create({ data:{ organizationId:actor.organizationId,employeeAccountId:account.accountId,actorUserId:actor.userId,action:'EMPLOYEE_LINKED',
      details:{ registrationFingerprint:fingerprint,source:'DIRECT_REGISTRATION',employeeId:employee.id,employeeNumber:employee.employeeNumber,role:input.role,reason:input.registrationReason } } });
    return { employeeId:employee.id,idempotent:false,invitation:account };
  },{ timeout:30000,maxWait:10000 });
  if (result.invitation?.status === 'INVITED' && input.sendInvitation) {
    const delivery = await deliverEmployeeInvitation({ ...result.invitation,organizationId:actor.organizationId,actorUserId:actor.userId,token:invitation.token,expiresAt:invitation.expiresAt,resent:false });
    return { employeeId:result.employeeId,idempotent:false,warning:delivery.warning };
  }
  return { employeeId:result.employeeId,idempotent:result.idempotent,warning:result.invitation?.status === 'INVITED' ? 'Send the activation email from the employee account tab when ready.' : undefined };
}

export async function changeEmployeeAccessRole(db: PrismaClient, actor: { organizationId:string; userId:string }, raw: unknown) {
  const input = z.object({ employeeId:z.string().min(1).max(200),role:z.enum(['EMPLOYEE','HR_ADMIN','FINANCE_OFFICER','ORGANIZATION_HEAD']),reason:z.string().trim().min(1).max(1000) }).parse(raw);
  return db.$transaction(async tx => {
    const account = await tx.employeeAccount.findFirst({ where:{ organizationId:actor.organizationId,employeeId:input.employeeId } });
    if (!account) throw new Error('Employee account not found in this organization.');
    const administrator = await assertEmployeeAccountManager(tx,{ organizationId:actor.organizationId,actorUserId:actor.userId,accountId:account.id });
    if (administrator.role !== 'ORGANIZATION_ADMIN') throw new Error('Only an Organization Administrator can change system access roles.');
    const current = await tx.employeeAccount.findUniqueOrThrow({ where:{ id:account.id },include:{ user:true,employee:true } });
    if (current.status !== 'ACTIVE' || current.employee.employeeStatus !== 'ACTIVE') throw new Error('Activate the linked employee account before changing its role. Pending invitations cannot be promoted.');
    if (current.user.role === input.role) return { changed:false };
    await tx.user.update({ where:{ id:current.userId },data:{ role:input.role } });
    // Existing DB triggers revoke sessions on role changes. Keep the explicit
    // deletion here as a second boundary and require a fresh login afterwards.
    await tx.staffSession.deleteMany({ where:{ userId:current.userId } });
    await tx.employeeAccountAudit.create({ data:{ organizationId:actor.organizationId,employeeAccountId:current.id,actorUserId:administrator.id,action:'ROLE_CHANGED',details:{ before:current.user.role,after:input.role,reason:input.reason } } });
    return { changed:true };
  },{ timeout:30000,maxWait:10000 });
}

export async function linkExistingEmployeeAccount(db:PrismaClient,actor:{organizationId:string;userId:string},raw:unknown) {
  const input=z.object({employeeId:z.string().min(1).max(200),existingUserId:z.string().min(1).max(200),reason:z.string().trim().min(1).max(1000)}).parse(raw);
  return db.$transaction(async tx=>{
    const administrator=await assertEmployeeAccountManager(tx,{organizationId:actor.organizationId,actorUserId:actor.userId});
    if(administrator.role!=='ORGANIZATION_ADMIN')throw new Error('Only an Organization Administrator can link existing accounts.');
    const user=await tx.user.findFirst({where:{id:input.existingUserId,organizationId:actor.organizationId},select:{role:true}});
    if(!user)throw new Error('Account not found in this organization.');
    const linked=await provisionEmployeeAccountInTransaction(tx,{organizationId:actor.organizationId,employeeId:input.employeeId,actorUserId:actor.userId,role:user.role,existingUserId:input.existingUserId,invitation:createEmployeeInvitation()});
    await tx.employeeAccountAudit.create({data:{organizationId:actor.organizationId,employeeAccountId:linked.accountId,actorUserId:actor.userId,action:'EMPLOYEE_LINKED',details:{source:'EXPLICIT_EXISTING_ACCOUNT_LINK',reason:input.reason}}});
    return linked;
  },{timeout:30000,maxWait:10000});
}

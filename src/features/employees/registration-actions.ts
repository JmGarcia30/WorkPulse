'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageEmployees } from '@/lib/permissions/rbac';
import { registerExistingEmployee, changeEmployeeAccessRole, linkExistingEmployeeAccount } from './registration';
import { EmployeeAccountError } from '@/features/employee-self-service/errors';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

type Result = { error?:string;success?:string;employeeId?:string;warning?:string };
function failure(error:unknown):Result {
  if (error instanceof z.ZodError) return { error:error.issues[0]?.message ?? 'Check the employee details.' };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { error:'An employee number, account email or registration already exists. Check the employee directory.' };
  if (error instanceof EmployeeAccountError) return { error:error.message };
  if (error instanceof Error && error.constructor === Error) return { error:error.message === 'EMPLOYEE_EMAIL_EXISTS' ? 'An employee with this email already exists.' : error.message };
  return { error:'Employee registration could not be completed. No partial employee or account was saved.' };
}
export async function registerExistingEmployeeAction(_state:Result,form:FormData):Promise<Result> {
  const actor = await requireBackOfficeContext();
  if (!canManageEmployees(actor)) throw new Error('FORBIDDEN');
  try {
    const result = await registerExistingEmployee(prisma,actor,{ ...Object.fromEntries(form),sendInvitation:form.get('sendInvitation') === 'yes',probationStandardsConfirmed:form.get('probationStandardsConfirmed') === 'yes' });
    revalidatePath('/dashboard/employees');revalidatePath(`/dashboard/employees/${result.employeeId}`);
    return { employeeId:result.employeeId,success:result.idempotent ? 'This employee registration is already saved.' : 'Employee and linked account registered.',warning:result.warning };
  } catch(error) { return failure(error); }
}
export async function changeEmployeeAccessRoleAction(_state:Result,form:FormData):Promise<Result> {
  const actor = await requireBackOfficeContext();
  if (actor.role !== 'ORGANIZATION_ADMIN') throw new Error('FORBIDDEN');
  try {
    if (form.get('confirmed') !== 'yes') return { error:'Confirm the access-role change.' };
    const input = Object.fromEntries(form);
    const result = await changeEmployeeAccessRole(prisma,actor,input);
    revalidatePath('/dashboard/employees');revalidatePath(`/dashboard/employees/${input.employeeId}`);
    return { success:result.changed ? 'Access role changed. Existing sessions were revoked; the account must sign in again.' : 'This access role is already assigned.' };
  } catch(error) { return failure(error); }
}

export async function linkExistingEmployeeAccountAction(_state:Result,form:FormData):Promise<Result>{
  const actor=await requireBackOfficeContext();
  if(actor.role!=='ORGANIZATION_ADMIN')throw new Error('FORBIDDEN');
  try{
    if(form.get('confirmed')!=='yes')return {error:'Confirm this account link.'};
    await linkExistingEmployeeAccount(prisma,actor,Object.fromEntries(form));
    revalidatePath(`/dashboard/employees/${form.get('employeeId')}`);
    return {success:'Existing account linked. Its password and access role are unchanged.'};
  }catch(error){return failure(error);}
}

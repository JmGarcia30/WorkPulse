import 'server-only';

import { cache } from 'react';
import { EmployeeAccountStatus, EmployeeStatus, Role } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

export interface EmployeeSelfContext {
  user: { id: string; name: string; email: string; role: Role };
  account: { id: string; status: EmployeeAccountStatus };
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string; email: string; status: EmployeeStatus };
  organization: { id: string; name: string; timeZone: string };
}

export class EmployeeSelfAccessError extends Error {
  constructor(public readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'ACCOUNT_UNAVAILABLE') {
    super('Employee self-service access is unavailable.');
    this.name = 'EmployeeSelfAccessError';
  }
}

export const requireEmployeeSelfContext = cache(async (): Promise<EmployeeSelfContext> => {
  const session = await getSession();
  if (!session) throw new EmployeeSelfAccessError('UNAUTHENTICATED');
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
      employeeAccount: {
        select: {
          id: true,
          organizationId: true,
          status: true,
          employee: {
            select: {
              id: true,
              organizationId: true,
              employeeNumber: true,
              firstName: true,
              lastName: true,
              email: true,
              employeeStatus: true,
            },
          },
          organization: { select: { id: true, name: true, timeZone: true } },
        },
      },
    },
  });
  if (!user || user.role !== Role.EMPLOYEE || user.role !== session.role || user.organizationId !== session.organizationId) {
    throw new EmployeeSelfAccessError('FORBIDDEN');
  }
  const account = user.employeeAccount;
  if (!account || account.status !== EmployeeAccountStatus.ACTIVE || account.organizationId !== user.organizationId || account.employee.organizationId !== user.organizationId || account.employee.employeeStatus !== EmployeeStatus.ACTIVE) {
    throw new EmployeeSelfAccessError('ACCOUNT_UNAVAILABLE');
  }
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    account: { id: account.id, status: account.status },
    employee: {
      id: account.employee.id,
      employeeNumber: account.employee.employeeNumber,
      firstName: account.employee.firstName,
      lastName: account.employee.lastName,
      email: account.employee.email,
      status: account.employee.employeeStatus,
    },
    organization: account.organization,
  };
});

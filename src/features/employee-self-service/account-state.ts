import { Prisma } from '@prisma/client';

// Internal transaction-aware primitive. Callers authenticate their actor and
// pass an existing transaction, so lifecycle changes and account audits commit
// together. It never performs email, cookie work, or nested transactions.
export async function disableEmployeeAccountInTransaction(tx: Prisma.TransactionClient, input: {
  organizationId: string; accountId: string; actorUserId: string; reason: string; now: Date;
}) {
  const account = await tx.employeeAccount.findFirst({ where: { id: input.accountId, organizationId: input.organizationId } });
  if (!account) throw new Error('Employee account is unavailable.');
  if (account.status === 'DISABLED') {
    if (account.activationTokenHash || account.activationTokenExpiresAt) throw new Error('Disabled account contains an invitation token.');
    return account;
  }
  const updated = await tx.employeeAccount.update({ where: { id: account.id }, data: {
    status: 'DISABLED', activationTokenHash: null, activationTokenExpiresAt: null,
    disabledAt: input.now, disabledReason: input.reason,
  } });
  await tx.employeeAccountAudit.create({ data: {
    organizationId: input.organizationId, employeeAccountId: account.id, actorUserId: input.actorUserId,
    action: 'DISABLED', details: { reason: input.reason, previousStatus: account.status },
  } });
  return updated;
}

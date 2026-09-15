import { prisma } from '../src/lib/db/prisma';
import { configureSagaLeavePolicy, SAGA_LEAVE_TYPES } from '../src/features/leave/saga-policy';

async function main() {
  const apply = process.argv.includes('--apply');
  const yearArg = process.argv.find((value) => value.startsWith('--year='));
  const year = yearArg ? Number(yearArg.split('=')[1]) : new Date().getFullYear();
  const organization = await prisma.organization.findUnique({ where: { slug: 'st-aloysius' }, include: { users: true } });
  if (!organization) throw new Error('SAGA organization not found.');
  const actor = organization.users.find((user) => user.role === 'ORGANIZATION_ADMIN' || user.role === 'HR_ADMIN');
  if (!actor) throw new Error('SAGA HR/Admin actor not found.');
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} SAGA leave policy for ${year}: ${SAGA_LEAVE_TYPES.map((item) => item.code).join(', ')}`);
  if (!apply) return;
  const configured = await configureSagaLeavePolicy({ organizationId: organization.id, actorUserId: actor.id, year });
  console.log(`Configured idempotently: ${configured.join(', ')}. No employee balances were granted.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

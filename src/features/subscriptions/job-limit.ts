import 'server-only';
import type { Prisma } from '@prisma/client';
import { activeJobLimit } from './domain';

export class ActiveJobLimitError extends Error {
  constructor() { super('Basic allows five simultaneously published job postings. Close an existing posting or request Pro before publishing another.'); this.name='ActiveJobLimitError'; }
}

export async function publishedJobCount(tx:Prisma.TransactionClient,organizationId:string) {
  return tx.job.count({where:{organizationId,status:'PUBLISHED'}});
}

export async function enforcePublishedJobIncrease(tx:Prisma.TransactionClient,organizationId:string,before:number) {
  const [subscription,after]=await Promise.all([
    tx.organizationSubscription.findUnique({where:{organizationId}}),publishedJobCount(tx,organizationId),
  ]);
  const limit=activeJobLimit(subscription);
  if(limit!==null&&after>limit&&after>before)throw new ActiveJobLimitError();
}

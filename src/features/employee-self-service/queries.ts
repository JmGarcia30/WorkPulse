import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { requireEmployeeSelfContext } from './context';
import * as data from './read-model';

export async function getMyCurrentSchedule(asOf = new Date()) {
  return data.getMyCurrentSchedule(await requireEmployeeSelfContext(), prisma, asOf);
}

export async function getMyProfile(asOf = new Date()) {
  return data.getMyProfile(await requireEmployeeSelfContext(), prisma, asOf);
}

export async function getMyDashboard(asOf = new Date()) {
  return data.getMyDashboard(await requireEmployeeSelfContext(), prisma, asOf);
}

export async function getMyAttendance(filters: { from: string; to: string }) {
  return data.getMyAttendance(await requireEmployeeSelfContext(), prisma, filters);
}

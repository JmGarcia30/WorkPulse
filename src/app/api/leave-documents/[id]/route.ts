import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) return new NextResponse('Unauthorized', { status: 401 });
  const user = await prisma.user.findFirst({ where: { id: session.userId, organizationId: session.organizationId, role: session.role }, include: { employeeAccount: true } });
  if (!user) return new NextResponse('Forbidden', { status: 403 });
  const { id } = await params;
  const document = await prisma.leaveDocument.findFirst({ where: { id, organizationId: user.organizationId, removedAt: null } });
  if (!document) return new NextResponse('Not found', { status: 404 });
  const hr = user.role === Role.ORGANIZATION_ADMIN || user.role === Role.HR_ADMIN;
  let own = false;
  if (user.role === Role.EMPLOYEE) {
    try {
      const context = await requireEmployeeSelfContext();
      own = context.organization.id === document.organizationId && context.employee.id === document.employeeId;
    } catch { return new NextResponse('Forbidden', { status: 403 }); }
  }
  if (!hr && !own) return new NextResponse('Forbidden', { status: 403 });
  try { const stored = await localStorageProvider.get(document.storageKey); return new NextResponse(new Uint8Array(stored.buffer), { headers: { 'Content-Type': document.fileType, 'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName)}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); } catch { return new NextResponse('File unavailable', { status: 404 }); }
}

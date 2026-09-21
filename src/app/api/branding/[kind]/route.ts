import { NextResponse } from 'next/server';
import { requireRequestTenant } from '@/lib/tenant/server';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const tenant = await requireRequestTenant();
    const { kind } = await params;
    if (kind !== 'logo' && kind !== 'login-image') return new NextResponse('Not found', { status: 404 });
    const record = await prisma.organizationBranding.findUnique({ where: { organizationId: tenant.organizationId }, select: { logoStorageKey: true, loginImageStorageKey: true } });
    const storageKey = kind === 'logo' ? record?.logoStorageKey : record?.loginImageStorageKey;
    if (!storageKey) return new NextResponse('Not found', { status: 404 });
    const file = await localStorageProvider.get(storageKey);
    return new NextResponse(new Uint8Array(file.buffer), { headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return new NextResponse('Not found', { status: 404 }); }
}

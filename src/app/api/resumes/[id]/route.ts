import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { id: documentId } = await params;

  // Look up document and enforce tenant isolation through Application -> Job -> Organization
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      application: {
        include: {
          job: {
            select: { organizationId: true },
          },
        },
      },
    },
  });

  if (!document || !document.application) {
    return new NextResponse('Document not found', { status: 404 });
  }

  // Tenant authorization check
  if (document.application.job.organizationId !== user.organizationId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { buffer, contentType } = await localStorageProvider.get(document.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return new NextResponse('Error reading file from storage', { status: 500 });
  }
}

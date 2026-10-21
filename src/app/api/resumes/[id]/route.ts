import { NextRequest, NextResponse } from 'next/server';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { safeCandidateDocumentContentType } from '@/features/hiring/document-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try { user = await requireBackOfficeContext(); }
  catch (error) {
    if (error instanceof Error && ['UNAUTHENTICATED', 'FORBIDDEN'].includes(error.message)) return new NextResponse('Unauthorized', { status: 401 });
    throw error;
  }
  if (!user || !canViewHiringData(user)) {
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
    const safeType = safeCandidateDocumentContentType(contentType);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': safeType,
        'Content-Disposition': `${safeType === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(document.fileName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}

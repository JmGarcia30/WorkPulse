import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  const doc = await prisma.recruitmentDocument.findUnique({
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

  if (!doc || !doc.storageKey) {
    return new NextResponse('Document not found or no file uploaded', { status: 404 });
  }

  // Authorization: check HR user session with tenant isolation
  const user = await getSession();
  const orgId = doc.application.job.organizationId;

  // Allow if HR belongs to the organization
  if (user && user.organizationId === orgId) {
    // Authorized
  } else {
    // Also allow candidate if query token or candidate context matches
    const searchParams = request.nextUrl.searchParams;
    const candidateAppId = searchParams.get('appId');
    if (!candidateAppId || candidateAppId !== doc.applicationId) {
      return new NextResponse('Unauthorized access to candidate document', { status: 403 });
    }
  }

  try {
    const { buffer, contentType } = await localStorageProvider.get(doc.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType || doc.fileType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(doc.fileName || 'document')}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading recruitment document from storage:', error);
    return new NextResponse('Error reading document from storage', { status: 500 });
  }
}

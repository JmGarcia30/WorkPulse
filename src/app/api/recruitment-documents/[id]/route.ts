import { candidateHasAccess } from '@/features/careers/candidate-access';
import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, getSession } from '@/lib/auth/session';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { candidateDocumentMatchesRequestTenant, safeCandidateDocumentContentType } from '@/features/hiring/document-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user = await getSession();
  // An invalid/revoked staff session must not fall through to candidate access.
  if (request.cookies.has(COOKIE_NAME) && !user) return new NextResponse('Forbidden', { status: 403 });
  if (user) {
    try { user = await requireBackOfficeContext(); }
    catch (error) {
      if (error instanceof Error && ['UNAUTHENTICATED', 'FORBIDDEN'].includes(error.message)) return new NextResponse('Forbidden', { status: 403 });
      throw error;
    }
    if (!canViewHiringData(user)) return new NextResponse('Forbidden', { status: 403 });
  }
  const { id: documentId } = await params;
  const candidateAppId = request.nextUrl.searchParams.get('appId');
  if (!user && (!candidateAppId || !await candidateHasAccess(candidateAppId))) return new NextResponse('Forbidden', { status: 403 });

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
  const orgId = doc.application.job.organizationId;
  if (!await candidateDocumentMatchesRequestTenant(orgId)) return new NextResponse('Forbidden', { status: 403 });

  // Allow if HR belongs to the organization
  if (user) {
    if (!canViewHiringData(user) || user.organizationId !== orgId) return new NextResponse('Forbidden', { status: 403 });
    // Authorized
  } else {
    // The session is verified above; IDs only select the owned resource.
    if (!candidateAppId || candidateAppId !== doc.applicationId) {
      return new NextResponse('Unauthorized access to candidate document', { status: 403 });
    }
  }

  try {
    const { buffer, contentType } = await localStorageProvider.get(doc.storageKey);
    const safeType = safeCandidateDocumentContentType(contentType || doc.fileType || undefined);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': safeType,
        'Content-Disposition': `${safeType === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.fileName || 'document')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}

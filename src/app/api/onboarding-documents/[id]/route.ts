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
  const { id: taskId } = await params;
  const candidateAppId = request.nextUrl.searchParams.get('appId');
  if (!user && (!candidateAppId || !await candidateHasAccess(candidateAppId))) return new NextResponse('Forbidden', { status: 403 });

  // Look up task and enforce tenant isolation: Task -> Process -> Application -> Job -> Organization
  const task = await prisma.onboardingTask.findUnique({
    where: { id: taskId },
    include: {
      onboardingProcess: {
        include: {
          application: {
            include: {
              job: {
                select: { organizationId: true },
              },
            },
          },
        },
      },
    },
  });

  if (!task || !task.storageKey) {
    return new NextResponse('Document not found', { status: 404 });
  }

  // Authorization check: User session (HR) OR candidate query parameter
  const taskOrgId = task.onboardingProcess.application.job.organizationId;
  if (!await candidateDocumentMatchesRequestTenant(taskOrgId)) return new NextResponse('Forbidden', { status: 403 });

  if (user) {
    if (!canViewHiringData(user) || user.organizationId !== taskOrgId) return new NextResponse('Forbidden', { status: 403 });
    // Authorized HR user
  } else {
    // The session is verified above; IDs only select the owned resource.
    if (!candidateAppId || candidateAppId !== task.onboardingProcess.applicationId) {
      return new NextResponse('Unauthorized access to onboarding document', { status: 403 });
    }
  }

  try {
    const { buffer, contentType } = await localStorageProvider.get(task.storageKey);
    const safeType = safeCandidateDocumentContentType(contentType);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': safeType,
        'Content-Disposition': `${safeType === 'application/octet-stream' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(task.fileName || 'document')}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new NextResponse('File unavailable', { status: 404 });
  }
}

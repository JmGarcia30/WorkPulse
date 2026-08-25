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

  const { id: taskId } = await params;

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

  // Multi-tenant authorization check
  const taskOrgId = task.onboardingProcess.application.job.organizationId;
  if (taskOrgId !== user.organizationId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const { buffer, contentType } = await localStorageProvider.get(task.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(task.fileName || 'document')}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading onboarding document from storage:', error);
    return new NextResponse('Error reading file from storage', { status: 500 });
  }
}

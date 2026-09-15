'use server';

import { revalidatePath } from 'next/cache';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { localStorageProvider } from '@/lib/storage';
import { prisma } from '@/lib/db/prisma';
import { LeaveRequestAuditAction, LeaveRequestStatus } from '@prisma/client';
import { removePendingLeaveDocument, submitLeaveRequest, withdrawLeaveRequest } from './service';
import { LeaveError } from './domain';
import { parseLeavePolicy } from './policy';

const MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const fail = (error: unknown) => ({ error: error instanceof LeaveError ? error.message : 'The leave operation could not be completed.' });

export async function submitMyLeaveRequestAction(input: { leaveTypeId: string; from: string; to: string; categoryCode?: string | null; reason: string; attestations?: Record<string, string | boolean> }) {
  const context = await requireEmployeeSelfContext();
  try {
    const result = await submitLeaveRequest({ ...input, organizationId: context.organization.id, employeeId: context.employee.id, actorUserId: context.user.id });
    revalidatePath('/employee/leave');
    revalidatePath(`/employee/leave/${result.id}`);
    return { success: true as const, ...result };
  } catch (error) { return fail(error); }
}

export async function withdrawMyLeaveRequestAction(requestId: string, confirmed: boolean) {
  const context = await requireEmployeeSelfContext();
  if (!confirmed) return { error: 'Confirmation is required.' };
  try { await withdrawLeaveRequest({ organizationId: context.organization.id, employeeId: context.employee.id, actorUserId: context.user.id, requestId }); revalidatePath('/employee/leave'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function uploadMyLeaveDocumentAction(requestId: string, formData: FormData) {
  const context = await requireEmployeeSelfContext();
  const request = await prisma.leaveRequest.findFirst({ where: { id: requestId, organizationId: context.organization.id, employeeId: context.employee.id, status: LeaveRequestStatus.PENDING }, include: { leaveType: true } });
  if (!request) return { error: 'Pending leave request not found.' };
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size || file.size > MAX_FILE_SIZE || !MIME.has(file.type)) return { error: 'Upload a PDF, JPEG, PNG, or WebP file up to 10 MB.' };
  const safeKind = String(formData.get('kindCode') ?? '').trim().toUpperCase();
  const allowedKinds = new Set([...parseLeavePolicy(request.leaveType).documents.map((rule) => rule.kindCode), 'SUPPORTING_DOCUMENT']);
  if (!allowedKinds.has(safeKind)) return { error: 'Document kind is not permitted for this leave type.' };
  const uploaded = await localStorageProvider.upload(Buffer.from(await file.arrayBuffer()), file.name, file.type, 'leave');
  try {
    const document = await prisma.leaveDocument.create({ data: { organizationId: context.organization.id, leaveRequestId: request.id, employeeId: context.employee.id, kindCode: safeKind, fileName: file.name.slice(0, 255), fileType: file.type, fileSize: file.size, storageKey: uploaded.storageKey, uploadedById: context.user.id } });
    await prisma.leaveRequestAudit.create({ data: { organizationId: context.organization.id, leaveRequestId: request.id, actorUserId: context.user.id, action: LeaveRequestAuditAction.DOCUMENT_ADDED, details: { documentId: document.id, kindCode: safeKind } } });
    revalidatePath(`/employee/leave/${request.id}`);
    return { success: true as const };
  } catch { await localStorageProvider.delete(uploaded.storageKey); return { error: 'Document metadata could not be saved.' }; }
}

export async function removeMyLeaveDocumentAction(requestId: string, documentId: string, confirmed: boolean) {
  const context = await requireEmployeeSelfContext();
  if (!confirmed) return { error: 'Confirmation is required.' };
  try {
    await removePendingLeaveDocument({ organizationId: context.organization.id, employeeId: context.employee.id, actorUserId: context.user.id, requestId, documentId });
    revalidatePath(`/employee/leave/${requestId}`);
    return { success: true as const };
  } catch (error) { return fail(error); }
}

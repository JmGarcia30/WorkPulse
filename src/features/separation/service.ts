import 'server-only';

import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { canManageSeparation } from '@/lib/permissions/rbac';
import { createSeparationService } from './core';
import { SeparationError } from './domain';

// No organization ID, actor ID, role, or timestamp is accepted from a caller.
const service = createSeparationService(prisma, async () => {
  const user = await requireBackOfficeContext();
  if (!canManageSeparation(user)) throw new SeparationError('FORBIDDEN', 'Separation administration is unavailable.');
  return { userId: user.userId, organizationId: user.organizationId, role: user.role };
});

export const {
  acknowledgeEmployeeResignation,
  getFinalPayManagement, createFinalPay, saveFinalPayDraft, reviewFinalPay, approveFinalPay, recordFinalPayPayment,
  getFinalPayPolicySettings, saveFinalPayDeadlinePolicy,
  getResignationPolicySettings, saveResignationPolicy,
  searchSeparationEmployees,
  createSeparationCase, updateSeparationCase, cancelSeparationCase,
  addClearanceItem, updateClearanceItem, recordClearanceDecision,
  recordNoticeException, recordSeparationReview, assessSeparationReadiness,
  markReadyForFinalReview, getSeparationCaseById, getEmployeeSeparationCases,
  getOrganizationSeparationCases, getEmployeeSeparationSummary, getSeparationAuditHistory,
  approveSeparationCase, executeSeparation, getFinalPayReadiness,
  getPendingFinalApprovals, getApprovedSeparations, getCompletedSeparations,
} = service;

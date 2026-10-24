'use server';

import { revalidatePath } from 'next/cache';
import { requireEmailAdministrator } from '@/features/email-integration/authorization';
import { HrWorkflowError, prepareHrWorkflow, sendHrWorkflow, type HrWorkflowRequest } from './hr-email-workflows';

const message = (error: unknown) => error instanceof HrWorkflowError ? error.message : 'Unable to complete the email action. Refresh the page and check your HR access and Email Integration.';
export async function previewHrEmailAction(input: HrWorkflowRequest) {
  try { return { preview: await prepareHrWorkflow(await requireEmailAdministrator(), input) }; }
  catch (error) { return { error: message(error) }; }
}
export async function sendHrEmailAction(input: HrWorkflowRequest, approval: { id: string; contentHash: string; confirmed: boolean }) {
  try {
    const result = await sendHrWorkflow(await requireEmailAdministrator(), input, approval);
    revalidatePath(`/dashboard/hiring/applicants/${input.applicationId}/email`);
    return result;
  } catch (error) { return { success: false, message: message(error) }; }
}

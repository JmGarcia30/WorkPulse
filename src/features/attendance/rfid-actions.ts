'use server';

import { revalidatePath } from 'next/cache';
import { rfidFailure, rfidHRContext, rfidService } from './rfid-server';

export async function searchRfidEmployees(query: string) {
  try {
    const employees = await rfidService().searchEmployees(await rfidHRContext(), typeof query === 'string' ? query : '');
    return { employees: employees.map(employee => ({ ...employee, rfidCards: employee.rfidCards.map(card => ({ ...card, createdAt: card.createdAt.toISOString() })) })) };
  } catch (error) { return rfidFailure(error); }
}

export async function enrollRfidCard(input: unknown) {
  try {
    await rfidService().enroll(await rfidHRContext(), input);
    revalidatePath('/dashboard/attendance/rfid');
    return { success: true as const };
  } catch (error) { return rfidFailure(error); }
}

export async function deactivateRfidCard(cardId: string) {
  try {
    await rfidService().deactivate(await rfidHRContext(), typeof cardId === 'string' ? cardId : '');
    revalidatePath('/dashboard/attendance/rfid');
    return { success: true as const };
  } catch (error) { return rfidFailure(error); }
}

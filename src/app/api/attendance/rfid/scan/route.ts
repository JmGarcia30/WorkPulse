import { rfidFailure, rfidKioskContext, rfidService } from '@/features/attendance/rfid-server';
import { assertRfidOrigin, readRfidJson, rfidJson } from '../transport';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await assertRfidOrigin(request);
    const { organizationId, token } = await rfidKioskContext();
    const input = await readRfidJson(request);
    const result = await rfidService().scan(organizationId, token, input);
    return rfidJson(result);
  } catch (error) {
    const failure = rfidFailure(error);
    return rfidJson(failure, failure.code === 'THROTTLED' ? 429 : failure.code === 'KIOSK_EXPIRED' || failure.code === 'UNAUTHORIZED' ? 401 : failure.code === 'UNAVAILABLE' ? 503 : 400);
  }
}

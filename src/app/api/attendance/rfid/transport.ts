import { headers } from 'next/headers';
import { requestAuthority } from '@/lib/tenant/host';
import { RfidError } from '@/features/attendance/rfid-service';

export async function assertRfidOrigin(request: Request) {
  const authority = requestAuthority(await headers());
  const origin = request.headers.get('origin');
  const protocol = process.env.NODE_ENV === 'production' ? 'https:' : 'http:';
  if (!authority || origin !== `${protocol}//${authority}`) throw new RfidError('INVALID_ORIGIN', 'Request origin is not allowed.');
}

export async function readRfidJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new RfidError('INVALID_INPUT', 'Send a valid scan request.');
  const reader = request.body?.getReader();
  if (!reader) throw new RfidError('INVALID_INPUT', 'Send a valid scan request.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) { await reader.cancel(); throw new RfidError('INVALID_INPUT', 'Scan request is too large.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof RfidError) throw error;
    throw new RfidError('INVALID_INPUT', 'Send a valid scan request.');
  } finally { reader.releaseLock(); }
}

export function rfidJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}

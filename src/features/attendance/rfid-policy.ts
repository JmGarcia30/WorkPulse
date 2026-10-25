import { AttendanceDirection } from '@prisma/client';
import { z } from 'zod';

export const cardNumberSchema = z.string().length(10, 'Scan a 10-digit numeric card.').regex(/^\d{10}$/, 'Scan a 10-digit numeric card.');
export const scanRequestSchema = z.object({ cardNumber: cardNumberSchema, requestId: z.string().uuid() }).strict();
export const enrollmentSchema = z.object({ employeeId: z.string().min(1).max(100), cardNumber: cardNumberSchema, expectedCardId: z.string().max(100).nullable() }).strict();
export const RFID_COOLDOWN_MS = 60_000;
export const RFID_KIOSK_SECONDS = 8 * 60 * 60;

type Event = { occurredAt: Date; direction: AttendanceDirection | null };
export function decideRfidDirection(events: Event[], now: Date, corrected: boolean, recentEvent = events.at(-1)) {
  if (corrected || events.some(event => !event.direction) || events.length > 2 ||
      (events[0] && events[0].direction !== AttendanceDirection.TIME_IN) ||
      (events[1] && events[1].direction !== AttendanceDirection.TIME_OUT)) return 'REVIEW_REQUIRED' as const;
  const latest = recentEvent;
  if (latest && latest.occurredAt > now) return 'REVIEW_REQUIRED' as const;
  if (latest && now.getTime() - latest.occurredAt.getTime() < RFID_COOLDOWN_MS) return 'DUPLICATE_SCAN' as const;
  if (events.length === 2) return 'DAY_COMPLETE' as const;
  return events.length === 0 ? AttendanceDirection.TIME_IN : AttendanceDirection.TIME_OUT;
}

export type RfidScanResult = {
  code: string;
  message: string;
  employeeName?: string;
  direction?: AttendanceDirection;
  occurredAt?: string;
  timeZone?: string;
};

export const rfidMessages: Record<string, string> = {
  RECORDED: 'Attendance recorded.',
  DUPLICATE_SCAN: 'Already recorded. Wait at least 60 seconds before scanning again.',
  DAY_COMPLETE: 'Time In and Time Out are already recorded for today.',
  REVIEW_REQUIRED: 'Please ask HR to review your attendance before scanning again.',
  UNKNOWN_CARD: 'Card not registered in this workspace. Please contact HR.',
  INACTIVE_CARD: 'This card is inactive. Please contact HR.',
  INACTIVE_EMPLOYEE: 'Attendance is unavailable for this employee. Please contact HR.',
  INVALID_INPUT: 'Scan a 10-digit numeric card.',
};

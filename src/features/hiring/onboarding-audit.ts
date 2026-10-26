/** Append an event without replacing historical notes or completion metadata.
 * Uses the existing process notes field; no schema/backfill is required. */
export function appendOnboardingAudit(
  notes: string | null | undefined,
  event: {
    action: 'TASK_REOPENED' | 'PROCESS_COMPLETED';
    actorUserId: string;
    organizationId: string;
    at: Date;
    historicalCompletedAt?: Date | null;
    reason?: string;
    taskId?: string;
    fromStatus: string;
    toStatus: string;
    previousVerification?: { status: string; verifiedAt?: Date | null; verifiedById?: string | null; reviewerNotes?: string | null };
  }
): string {
  return `${notes || ''}${notes ? '\n' : ''}[onboarding-audit] ${JSON.stringify(event)}`;
}

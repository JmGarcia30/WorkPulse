-- Restore job lifecycle writes introduced by PRs #19/#20.
-- Production rejected JOB_ARCHIVED with SQLSTATE 23514 because the original
-- AccountSecurityEvent check constraint did not include new recruitment events.
-- Preserve all prior values, immutable triggers, stored events and foreign keys.
-- Replacing the old/new constraints in a single ALTER TABLE is atomic.
ALTER TABLE "AccountSecurityEvent"
  DROP CONSTRAINT "AccountSecurityEvent_action_check",
  ADD CONSTRAINT "AccountSecurityEvent_action_check"
    CHECK ("action" IN (
      'PROFILE_UPDATED',
      'PASSWORD_CHANGED',
      'LOGIN_LOCKOUT',
      'PASSWORD_RESET_REQUESTED',
      'PASSWORD_RESET_COMPLETED',
      'SECURITY_ALERT_CLAIMED',
      'SECURITY_ALERT_ACCEPTED',
      'SECURITY_ALERT_FAILED',
      'DRAFT_JOB_DELETED',
      'JOB_CREATED',
      'JOB_UPDATED',
      'JOB_PUBLISHED',
      'JOB_CLOSED',
      'JOB_ARCHIVED',
      'JOB_REUSED',
      'JOB_REUSE_REQUEST',
      'JOB_AUTO_CLOSED'
    )) NOT VALID;

-- Existing rows were accepted by the old (narrower) check, so validation
-- should succeed without modifying their content.
ALTER TABLE "AccountSecurityEvent"
  VALIDATE CONSTRAINT "AccountSecurityEvent_action_check";

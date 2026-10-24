# Email Integration test recipient fix

The original Test Email handler selected the signed-in HR user's stored `User.email` without asking for a recipient. This could target a login address that had no working mailbox. The reported “Address not found” concerned that destination; the repository alone does not establish the existence of a real mailbox.

The existing Test Email form now requires a recipient address. Both the browser and server validate it; the server trims/normalizes the address and rejects missing, malformed, multiple, injected, or oversized addresses before sending. The success message names the recipient and asks HR to confirm receipt. Gmail acceptance does not guarantee inbox delivery, so a syntactically valid but nonexistent address can still bounce.

The recipient changes only the message's To address. Authorization, the tenant-bound Gmail credentials and verified From address, the test rate limit, and SAGA's successful-test marker/explicit activation requirement are unchanged. Invalid input does not send or alter connection readiness; a failed Gmail send cannot qualify a fresh SAGA connection for activation. No onboarding, recruitment, schema, migration, or other email workflow was changed by this fix.

Validation completed: **111 service checks and 19 browser/concurrency checks passed**, along with TypeScript, the application build, and targeted ESLint. The browser run used a disposable company and `--recipient-only`, leaving any existing SAGA connection untouched; the rollback-only service suite covered SAGA's selected-recipient and activation behavior. Google responses were synthetic. All 63 table fingerprints matched after tests, and browser fixtures were removed.

To test manually:

1. Run `npm run dev` and open the connected organization's **Settings → Email Integration**, for example `http://saga.localhost:3000/dashboard/settings/email-integration`.
2. Enter an inbox you control in **Test recipient email**, then select **Send test email**. Blank or invalid input should block submission or show a validation error.
3. Confirm that the result names your chosen address, and check that inbox/spam folder. For SAGA, confirm receipt before explicitly activating Gmail recruitment sending.

No implementation tasks remain. Live delivery confirmation to a real inbox is a manual acceptance check; no real Google mail was sent during automated tests. Existing data, production, and unrelated local changes were preserved. Nothing was pushed, deployed, or reset.

Rerun focused verification:

```powershell
node scripts/email-integration-recovery.cjs test
node scripts/email-integration-browser.cjs --recipient-only
node node_modules/typescript/bin/tsc --noEmit
```

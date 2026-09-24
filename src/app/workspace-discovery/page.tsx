import { WorkspaceDiscoveryForm } from '@/components/public/WorkspaceDiscoveryForm';
import { normalizeHostname, publicOrigin, rootDomain, usesTemporaryPathTenancy } from '@/lib/tenant/host';
import styles from '@/components/public/WorkspaceDiscovery.module.css';

export default function WorkspaceDiscoveryPage() {
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="workspace-heading">
          <a href={publicOrigin()} className={styles.brand} aria-label="Back to WorkPulse">
            <span>W</span>
            WorkPulse
          </a>

          <div className={styles.introCopy}>
            <p className={styles.eyebrow}>Secure workspace access</p>
            <h1 id="workspace-heading">Find your WorkPulse workspace.</h1>
            <p className={styles.supportingCopy}>
              Each organization has its own secure WorkPulse sign-in. Enter the workspace name supplied by your organization to continue.
            </p>

            <div className={styles.accessPath} aria-label="Workspace access path">
              <div><span>01</span><strong>Find your organization</strong></div>
              <div><span>02</span><strong>Continue to secure sign in</strong></div>
            </div>
          </div>

          <p className={styles.assurance}>Organization workspaces remain separate and securely scoped.</p>
        </section>

        <section className={styles.formPanel} aria-label="Find your organization">
          <div className={styles.formHeading}>
            <p>Enter your workspace</p>
            <span>Provided by your organization</span>
          </div>
          <WorkspaceDiscoveryForm
            publicUrl={publicOrigin()}
            rootSuffix={normalizeHostname(rootDomain())}
            pathTenantRouting={usesTemporaryPathTenancy(new URL(publicOrigin()).host)}
          />
        </section>
      </div>
    </main>
  );
}

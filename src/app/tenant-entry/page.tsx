import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { JobStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/routing';
import { prisma } from '@/lib/db/prisma';
import { requireRequestTenant } from '@/lib/tenant/server';
import { getPublicTenantContent } from '@/lib/tenant/public-content';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { TenantLogo } from '@/components/layout/TenantLogo';
import { TenantNavigation } from './TenantNavigation';
import styles from './tenant-entry.module.css';

export const metadata: Metadata = {
  title: 'Organization Workspace | WorkPulse',
  description: 'Access organization services, public announcements, and career opportunities.',
};

export default async function TenantEntryPage() {
  const tenant = await requireRequestTenant();
  const session = await getSession();

  if (session?.organizationId === tenant.organizationId) redirect(landingPathForRole(session.role));

  const content = getPublicTenantContent(tenant.slug);
  const jobs = tenant.careersEnabled
    ? await prisma.job.findMany({
        where: { organizationId: tenant.organizationId, status: JobStatus.PUBLISHED },
        select: { id: true, slug: true, title: true, department: true, employmentType: true, location: true },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      })
    : [];
  const announcements = content.announcements.map((announcement) => ({
    ...announcement,
    imageAvailable: announcement.imageUrl
      ? existsSync(join(process.cwd(), 'public', announcement.imageUrl.replace(/^\//, '')))
      : false,
  }));
  const featuredAnnouncement = announcements[0];
  const heroImageAvailable = content.heroImageUrl
    ? existsSync(join(process.cwd(), 'public', content.heroImageUrl.replace(/^\//, '')))
    : false;

  return (
    <TenantTheme branding={tenant} className={styles.theme}>
      <div className={styles.page} id="top">
        <span id="tenant-nav-sentinel" className={styles.navSentinel} aria-hidden="true" />
        <TenantNavigation branding={tenant} careersEnabled={tenant.careersEnabled} navigationName={content.organizationNavigationName} />

        <main>
          <section className={styles.hero} aria-labelledby="tenant-welcome">
            <div className={styles.heroInner}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>{content.workspaceLabel}</p>
                <h1 id="tenant-welcome">Welcome to {tenant.displayName}</h1>
                <p className={styles.summary}>Access workforce services, employee resources, and career opportunities through your organization&apos;s WorkPulse workspace.</p>
                <div className={styles.actions}>
                  <Link href="/login" className={styles.primaryAction}>Log In</Link>
                  {tenant.careersEnabled && <Link href="#careers" className={styles.secondaryAction}>View Careers</Link>}
                </div>
                <p className={styles.powered}>Powered by <strong>WorkPulse</strong></p>
              </div>
              <div className={styles.heroMedia}>
                {heroImageAvailable && content.heroImageUrl ? (
                  <Image
                    src={content.heroImageUrl}
                    alt={`${tenant.displayName} campus`}
                    fill
                    sizes="(max-width: 640px) calc(100vw - 32px), 42vw"
                    className={styles.heroPhoto}
                    priority
                  />
                ) : (
                  <div className={styles.crestComposition}>
                    <TenantLogo branding={tenant} size={360} className={styles.heroLogo} fallbackClassName={styles.heroLogoFallback} priority />
                    <p>{tenant.displayName}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className={styles.announcements} id="announcements" aria-labelledby="announcements-title">
            <div className={styles.sectionInner}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Latest from {content.organizationShortName}</p>
                <h2 id="announcements-title">Announcements</h2>
              </div>
              {featuredAnnouncement ? (
                <article className={styles.announcementFeature}>
                  <div className={styles.announcementCopy}>
                    {featuredAnnouncement.date && <time>{featuredAnnouncement.date}</time>}
                    <h3>{featuredAnnouncement.title}</h3>
                    <p>{featuredAnnouncement.description}</p>
                    {featuredAnnouncement.href && <Link href={featuredAnnouncement.href}>Learn more <span aria-hidden="true">→</span></Link>}
                  </div>
                  {featuredAnnouncement.imageUrl && featuredAnnouncement.imageAvailable && (
                    <div className={styles.posterFrame}>
                      <Image src={featuredAnnouncement.imageUrl} alt={`${featuredAnnouncement.title} announcement poster`} width={900} height={1200} className={styles.poster} />
                    </div>
                  )}
                </article>
              ) : <p className={styles.emptyAnnouncement}>There are no public announcements at this time.</p>}
            </div>
          </section>

          {tenant.careersEnabled && (
            <section className={styles.careers} id="careers" aria-labelledby="careers-title">
              <div className={styles.sectionInner}>
                <div className={styles.careersHeader}>
                  <div className={styles.sectionHeading}>
                    <p className={styles.eyebrow}>Careers at {content.organizationShortName}</p>
                    <h2 id="careers-title">Join the {content.organizationShortName} community.</h2>
                    <p>Explore current opportunities at {tenant.displayName}.</p>
                  </div>
                  <Link href="/careers" className={styles.textLink}>View All Careers <span aria-hidden="true">→</span></Link>
                </div>
                <div className={styles.jobList}>
                  {jobs.length > 0 ? jobs.map((job, index) => (
                    <article className={styles.jobRow} key={job.id} style={{ '--row-index': index } as CSSProperties}>
                      <div><p className={styles.jobDepartment}>{job.department}</p><h3>{job.title}</h3></div>
                      <p className={styles.jobMeta}>{job.employmentType}<span aria-hidden="true">·</span>{job.location}</p>
                      <Link href={`/careers/${job.slug}`} aria-label={`View ${job.title} position`}>View Position <span aria-hidden="true">→</span></Link>
                    </article>
                  )) : (
                    <div className={styles.noJobs}><h3>No current openings</h3><p>There are no published positions at this time. Please check again later.</p></div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className={styles.access} aria-labelledby="access-title">
            <div className={styles.accessInner}>
              <div className={styles.accessLead}>
                <p className={styles.darkEyebrow}>Your organization account</p>
                <h2 id="access-title">Access your {content.organizationShortName} workspace.</h2>
                <p>Sign in using the account provided by your organization.</p>
                <div className={styles.actions}>
                  <Link href="/login" className={styles.goldAction}>Log In</Link>
                  {tenant.careersEnabled && <Link href="/careers" className={styles.darkSecondaryAction}>View Careers</Link>}
                </div>
              </div>
              <div className={styles.audiences}>
                <div><h3>HR &amp; Administration</h3><p>Manage workforce operations and employee records.</p></div>
                <div><h3>Employees</h3><p>Access attendance, leave, and employment information.</p></div>
                {tenant.careersEnabled && <div><h3>Applicants</h3><p>Explore current career opportunities.</p></div>}
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <Link href="#top" className={styles.footerIdentity}>
              <TenantLogo branding={tenant} size={54} className={styles.footerLogo} fallbackClassName={styles.logoFallback} />
              <span>{tenant.displayName}</span>
            </Link>
            <nav aria-label="Footer navigation">
              <Link href="#top">Home</Link><Link href="#announcements">Announcements</Link>
              {tenant.careersEnabled && <Link href="#careers">Careers</Link>}<Link href="/login">Log In</Link>
            </nav>
            <div className={styles.footerMeta}>
              <p>Powered by <strong>WorkPulse</strong></p>
              {(tenant.address || tenant.contactEmail || tenant.contactPhone) && <address>{[tenant.address, tenant.contactEmail, tenant.contactPhone].filter(Boolean).join(' · ')}</address>}
            </div>
          </div>
        </footer>
      </div>
    </TenantTheme>
  );
}

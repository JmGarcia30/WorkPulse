import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { JobStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
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
  title: 'St. Aloysius Gonzaga Academy | Institutional Workspace',
  description:
    'Official workforce operations, faculty portal, and career opportunities for St. Aloysius Gonzaga Academy, Inc.',
};

export default async function TenantEntryPage() {
  const tenant = await requireRequestTenant();
  const session = await getSession();

  if (session?.organizationId === tenant.organizationId) {
    redirect(landingPathForRole(session.role));
  }

  const content = getPublicTenantContent(tenant.slug);
  const jobs = tenant.careersEnabled
    ? await prisma.job.findMany({
        where: { organizationId: tenant.organizationId, status: JobStatus.PUBLISHED },
        select: {
          id: true,
          slug: true,
          title: true,
          department: true,
          employmentType: true,
          location: true,
          category: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: 4,
      })
    : [];

  const announcements = content.announcements.map((announcement) => ({
    ...announcement,
    imageAvailable: announcement.imageUrl
      ? existsSync(join(process.cwd(), 'public', announcement.imageUrl.replace(/^\//, '')))
      : false,
  }));
  const featuredAnnouncement = announcements[0];

  const institutionalPortals = [
    {
      num: '01',
      id: 'faculty',
      title: 'Faculty & Academic Staff',
      description:
        'Manage teaching schedules, attendance, employee information, and institutional records.',
      href: '/login',
      ctaText: 'Access Faculty Portal',
    },
    {
      num: '02',
      id: 'leave',
      title: 'Leave & Absences',
      description:
        'Submit and review institutional leave requests, track service credit balances, and approval workflows.',
      href: '/login',
      ctaText: 'File Leave Request',
    },
    {
      num: '03',
      id: 'careers',
      title: 'Faculty Recruitment',
      description:
        'Structured institutional hiring pipeline with PRC LET verification and SAGA credential submission.',
      href: tenant.careersEnabled ? '#careers' : '/login',
      ctaText: 'Explore Open Positions',
    },
    {
      num: '04',
      id: 'admin',
      title: 'HR & Administration',
      description:
        'Centralized workforce master files, department management, payroll cutoffs, and DepEd institutional compliance.',
      href: '/login',
      ctaText: 'HR & Admin Sign In',
    },
  ];

  const institutionalPrinciples = [
    {
      num: '01',
      title: 'Academic Rigor & DepEd Standards',
      description:
        'Accredited curriculum aligned with Department of Education standards, fostering academic excellence across Junior High School and Senior High School academic strands.',
    },
    {
      num: '02',
      title: 'Catholic Character & Faith Formation',
      description:
        'Rooted in the Gonzaga Catholic tradition, cultivating ethical leadership, moral integrity, compassion, and holistic student and faculty community life.',
    },
    {
      num: '03',
      title: 'Modern Connected Campus Operations',
      description:
        'Powered by WorkPulse SaaS infrastructure to eliminate lost paperwork, enforce transparent attendance policies, and maintain verified faculty credentials.',
    },
  ];

  return (
    <TenantTheme branding={tenant} className={styles.theme}>
      <div className={styles.page} id="top">
        <span id="tenant-nav-sentinel" className={styles.navSentinel} aria-hidden="true" />
        <TenantNavigation
          branding={tenant}
          careersEnabled={tenant.careersEnabled}
          navigationName={content.organizationNavigationName}
        />

        <main>
          {/* 1. Hero Section — Confident, uncluttered, academic */}
          <section className={styles.hero} aria-labelledby="tenant-welcome">
            <div className={styles.heroBackdropPattern} aria-hidden="true" />
            <div className={styles.heroInner}>
              <div className={styles.heroCopy}>
                <div className={styles.eyebrow}>
                  <span className={styles.eyebrowRule} />
                  <span>{content.workspaceLabel}</span>
                </div>

                <h1 id="tenant-welcome" className={styles.heroTitle}>
                  Excellence, Character &amp; Leadership.
                  <span className={styles.goldText}>{tenant.displayName}</span>
                </h1>

                <p className={styles.heroSummary}>
                  The official workforce and academic operations platform for faculty, staff, and administration at St. Aloysius Gonzaga Academy, Inc. Access digital timekeeping, leave clearances, applicant reviews, and institutional services in one connected workspace.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/login" className={styles.primaryAction}>
                    <span>Faculty &amp; Staff Sign In</span>
                    <ArrowRight size={14} />
                  </Link>
                  {tenant.careersEnabled && (
                    <Link href="#careers" className={styles.secondaryAction}>
                      <span>Explore Career Opportunities</span>
                    </Link>
                  )}
                </div>

                <div className={styles.heroTrustRow}>
                  <span className={styles.heroTrustItem}>DepEd Recognized Institution</span>
                  <span className={styles.heroTrustSep}>&bull;</span>
                  <span className={styles.heroTrustItem}>Basic Education &amp; Senior High School</span>
                  <span className={styles.heroTrustSep}>&bull;</span>
                  <span className={styles.heroTrustItem}>Verified WorkPulse Workspace</span>
                </div>
              </div>

              {/* Dignified SAGA Crest Showcase */}
              <div className={styles.heroMedia}>
                <div className={styles.crestShowcase}>
                  <div className={styles.crestFrame}>
                    <TenantLogo
                      branding={tenant}
                      size={180}
                      className={styles.heroLogoImg}
                      fallbackClassName={styles.heroLogoFallback}
                      priority
                    />
                  </div>
                  <div className={styles.crestMeta}>
                    <div className={styles.crestTitle}>{tenant.displayName}</div>
                    <div className={styles.crestDivider} />
                    <div className={styles.crestSubtitle}>Institutional Workforce Hub</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Portals Section — Editorial Directory (Option B Full-Width Rows) */}
          <section className={styles.portalsSection} id="portals" aria-labelledby="portals-title">
            <div className={styles.sectionInner}>
              <div className={styles.sectionHeadingEditorial}>
                <div className={styles.eyebrow}>
                  <span className={styles.eyebrowRule} />
                  <span>Institutional Directory</span>
                </div>
                <h2 id="portals-title">Dedicated access for every member of SAGA</h2>
                <p>
                  Direct access to workforce tools, attendance tracking, and administrative services tailored to your institutional role.
                </p>
              </div>

              <div className={styles.directoryList}>
                {institutionalPortals.map((portal) => (
                  <Link href={portal.href} key={portal.id} className={styles.directoryRow}>
                    <span className={styles.directoryNum}>{portal.num}</span>
                    <div className={styles.directoryBody}>
                      <h3 className={styles.directoryTitle}>{portal.title}</h3>
                      <p className={styles.directoryDescription}>{portal.description}</p>
                    </div>
                    <div className={styles.directoryAction}>
                      <span>{portal.ctaText}</span>
                      <ArrowRight size={14} className={styles.directoryArrow} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* 3. Announcements Section — Featured Visual Editorial */}
          <section className={styles.announcements} id="announcements" aria-labelledby="announcements-title">
            <div className={styles.sectionInner}>
              <div className={styles.sectionHeadingEditorial}>
                <div className={styles.eyebrow}>
                  <span className={styles.eyebrowRule} />
                  <span>Campus Bulletin</span>
                </div>
                <h2 id="announcements-title">Official Announcements &amp; Notices</h2>
                <p>Keep up with campus bulletins, admission periods, and institutional updates.</p>
              </div>

              {featuredAnnouncement ? (
                <article className={styles.featuredAnnouncement}>
                  <div className={styles.announcementCopy}>
                    <div className={styles.announcementStatus}>
                      <span className={styles.statusDot} />
                      <span>Academic Year 2026–2027</span>
                    </div>

                    <h3 className={styles.announcementTitle}>{featuredAnnouncement.title}</h3>
                    <p className={styles.announcementText}>{featuredAnnouncement.description}</p>

                    <div className={styles.announcementDetails}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Academic Offerings</span>
                        <span className={styles.detailValue}>Junior High School &amp; Senior High School (STEM &bull; ABM &bull; HUMSS &bull; TVL)</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Enrollment Status</span>
                        <span className={styles.detailValue}>Admissions &amp; Application Verification Active</span>
                      </div>
                    </div>

                    <div className={styles.announcementActionRow}>
                      {featuredAnnouncement.href ? (
                        <Link href={featuredAnnouncement.href} className={styles.announcementBtn}>
                          <span>Admissions Guidelines &amp; Requirements</span>
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <Link href="/login" className={styles.announcementBtn}>
                          <span>Contact Admissions &amp; Registrar</span>
                          <ArrowRight size={13} />
                        </Link>
                      )}
                    </div>
                  </div>

                  {featuredAnnouncement.imageUrl && featuredAnnouncement.imageAvailable ? (
                    <div className={styles.announcementPosterWrap}>
                      <Image
                        src={featuredAnnouncement.imageUrl}
                        alt={`${featuredAnnouncement.title} poster`}
                        width={840}
                        height={1100}
                        className={styles.announcementPoster}
                      />
                    </div>
                  ) : (
                    <div className={styles.announcementEditorialCard}>
                      <div className={styles.editorialCardHeader}>
                        <span className={styles.editorialSeal}>SAGA</span>
                        <div>
                          <div className={styles.editorialCardTitle}>Office of the Registrar</div>
                          <div className={styles.editorialCardSub}>Admissions &amp; Enrollment Division</div>
                        </div>
                      </div>
                      <div className={styles.editorialDivider} />
                      <div className={styles.editorialSummaryList}>
                        <div className={styles.editorialSummaryRow}>
                          <strong>Academic Levels</strong>
                          <span>Grades 7–10 (JHS) &bull; Grades 11–12 (SHS)</span>
                        </div>
                        <div className={styles.editorialSummaryRow}>
                          <strong>Accreditation</strong>
                          <span>Department of Education Recognized &bull; ESC Certified</span>
                        </div>
                        <div className={styles.editorialSummaryRow}>
                          <strong>Campus Office Hours</strong>
                          <span>Monday to Friday, 8:00 AM – 5:00 PM PHT</span>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ) : (
                <p className={styles.emptyAnnouncement}>There are no public announcements at this time.</p>
              )}
            </div>
          </section>

          {/* 4. Careers Section — Row Layout */}
          {tenant.careersEnabled && (
            <section className={styles.careers} id="careers" aria-labelledby="careers-title">
              <div className={styles.sectionInner}>
                <div className={styles.careersHeader}>
                  <div className={styles.sectionHeadingEditorial}>
                    <div className={styles.eyebrow}>
                      <span className={styles.eyebrowRule} />
                      <span>Academic &amp; Staff Appointments</span>
                    </div>
                    <h2 id="careers-title">Join the {content.organizationShortName} Faculty &amp; Staff</h2>
                    <p>
                      Shape the future of education. Explore teaching and administrative opportunities at {tenant.displayName}.
                    </p>
                  </div>
                  <Link href="/careers" className={styles.careersViewAll}>
                    <span>View All Openings ({jobs.length})</span>
                    <ArrowRight size={14} />
                  </Link>
                </div>

                <div className={styles.jobList}>
                  {jobs.length > 0 ? (
                    jobs.map((job) => {
                      const isTeaching = job.category === 'TEACHING';
                      return (
                        <article className={styles.jobRow} key={job.id}>
                          <div className={styles.jobMain}>
                            <span className={styles.jobCategory}>
                              {isTeaching ? 'Teaching Faculty' : 'Non-Teaching Personnel'} &bull; {job.department}
                            </span>
                            <h3 className={styles.jobTitle}>{job.title}</h3>
                          </div>
                          <div className={styles.jobMeta}>
                            <span>{job.employmentType}</span>
                            <span className={styles.jobMetaDot}>&bull;</span>
                            <span>{job.location}</span>
                          </div>
                          <div className={styles.jobAction}>
                            <Link
                              href={`/careers/${job.slug}`}
                              className={styles.jobApplyLink}
                              aria-label={`View position and apply for ${job.title}`}
                            >
                              <span>View Position &amp; Apply</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className={styles.noJobs}>
                      <h3>No Open Positions at this Time</h3>
                      <p>
                        Please check back regularly or contact the HR department for future academic openings.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 5. Institutional Foundations — Numbered Editorial Principles */}
          <section className={styles.foundationsSection} id="about" aria-labelledby="foundations-title">
            <div className={styles.sectionInner}>
              <div className={styles.sectionHeadingEditorial}>
                <div className={styles.eyebrow}>
                  <span className={styles.eyebrowRule} />
                  <span>Institutional Foundations</span>
                </div>
                <h2 id="foundations-title">Commitment to academic and moral excellence</h2>
                <p>
                  Our educational philosophy is grounded in holistic student development, academic rigor, and disciplined institutional governance.
                </p>
              </div>

              <div className={styles.principlesGrid}>
                {institutionalPrinciples.map((principle) => (
                  <div key={principle.num} className={styles.principleItem}>
                    <div className={styles.principleRule} />
                    <span className={styles.principleNum}>{principle.num}</span>
                    <h3 className={styles.principleTitle}>{principle.title}</h3>
                    <p className={styles.principleDescription}>{principle.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. Access Section — Calm, Premium Dark Split Layout */}
          <section className={styles.access} aria-labelledby="access-title">
            <div className={styles.accessInner}>
              <div className={styles.accessLead}>
                <div className={styles.accessEyebrow}>
                  <span className={styles.accessEyebrowRule} />
                  <span>Single Sign-On &bull; WorkPulse Cloud</span>
                </div>
                <h2 id="access-title">Access your {content.organizationShortName} workspace.</h2>
                <p>
                  Sign in using your institutional email and credentials provided by the IT &amp; HR administration.
                </p>
                <div className={styles.accessActions}>
                  <Link href="/login" className={styles.goldAction}>
                    <span>Proceed to Sign In</span>
                    <ArrowRight size={14} />
                  </Link>
                  {tenant.careersEnabled && (
                    <Link href="/careers" className={styles.darkSecondaryAction}>
                      <span>Applicant Portal</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className={styles.audiences}>
                <div className={styles.audienceItem}>
                  <span className={styles.audienceNum}>01</span>
                  <div>
                    <h3>Faculty &amp; Teaching Personnel</h3>
                    <p>Access daily class time records, schedule confirmations, and personal profile updates.</p>
                  </div>
                </div>
                <div className={styles.audienceItem}>
                  <span className={styles.audienceNum}>02</span>
                  <div>
                    <h3>HR, Registrar &amp; Campus Administration</h3>
                    <p>Manage personnel master files, biometric attendance verification, and institutional leave.</p>
                  </div>
                </div>
                {tenant.careersEnabled && (
                  <div className={styles.audienceItem}>
                    <span className={styles.audienceNum}>03</span>
                    <div>
                      <h3>Candidates &amp; Teaching Applicants</h3>
                      <p>Submit required SAGA credentials, track recruitment milestones, and review job offers.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        {/* 7. Footer — Minimal, Elegant */}
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <Link href="#top" className={styles.footerIdentity} aria-label={`${tenant.displayName} top`}>
              <div className={styles.footerLogoRing}>
                <TenantLogo
                  branding={tenant}
                  size={36}
                  className={styles.footerLogo}
                  fallbackClassName={styles.footerLogoFallback}
                />
              </div>
              <div>
                <div className={styles.footerName}>{tenant.displayName}</div>
                <div className={styles.footerSub}>
                  DepEd Recognized &bull; Senior High &amp; Basic Education
                </div>
              </div>
            </Link>

            <nav className={styles.footerNav} aria-label="Footer navigation">
              <Link href="#top">Home</Link>
              <Link href="#portals">Portals</Link>
              <Link href="#announcements">Announcements</Link>
              {tenant.careersEnabled && <Link href="#careers">Careers</Link>}
              <Link href="#about">About SAGA</Link>
              <Link href="/login">Sign In</Link>
            </nav>

            <div className={styles.footerMeta}>
              <p>
                Powered by <strong>WorkPulse</strong> &bull; Institutional Workforce Platform
              </p>
              {(tenant.address || tenant.contactEmail || tenant.contactPhone) && (
                <address className={styles.footerAddress}>
                  {[tenant.address, tenant.contactEmail, tenant.contactPhone].filter(Boolean).join(' · ')}
                </address>
              )}
              <p className={styles.footerCopyright}>
                &copy; {new Date().getFullYear()} {tenant.displayName}. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </TenantTheme>
  );
}

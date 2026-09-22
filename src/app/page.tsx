import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, CalendarCheck2, Check, Clock3, FileSearch, Fingerprint, History, KeyRound, Lock, ScanText, Server, UserCheck, UsersRound } from 'lucide-react';
import { discoveryOrigin } from '@/lib/tenant/host';
import { LandingNavbar } from './landing-navbar';
import styles from './landing.module.css';

const lifecycleStages = [
  { number: '01', title: 'Hiring', description: 'Recruit candidates, review qualifications, manage interviews, and move successful applicants into onboarding.' },
  { number: '02', title: 'Active Employment', description: 'Manage employee records, attendance, leave, probation, and employee self-service in one place.' },
  { number: '03', title: 'Exit', description: 'Support the transition out of the organization through structured separation and record handling.' },
] as const;

const faqItems = [
  ['What is WorkPulse?', 'WorkPulse is a multi-tenant workforce platform that connects recruitment, employee records, employment management, attendance, leave, and employee self-service.'],
  ['Can each organization have its own workspace?', 'Yes. Each organization operates in its own WorkPulse workspace with server-enforced organization boundaries.'],
  ['Can organizations customize their branding?', 'Yes. Organizations can use their own display name, logo, primary color, and accent color within the WorkPulse platform structure.'],
  ['Does AI make hiring decisions?', 'No. AI helps organize resume information and compare evidence with job requirements. HR staff and Hiring Managers review the evidence and make the final decision.'],
  ['Can employees access WorkPulse?', 'Yes. Employee Self-Service lets employees view their profile, attendance, and leave requests without access to administrative tools.'],
  ['Which modules are available now?', 'Current modules include AI-assisted recruitment, applicant tracking, interview workflows, digital onboarding, employee records, probation and employment management, attendance, leave management, and Employee Self-Service.'],
  ['Which features are planned?', 'Payroll, Workforce Analytics, RFID hardware integration, and Exit / Post-Employment are planned and are not currently available.'],
] as const;

function Brand() {
  return <Link href="/" className={styles.brand} aria-label="WorkPulse home"><span className={styles.brandMonogram}>W</span><span>WorkPulse</span></Link>;
}

function ProductPreview() {
  return <div className={styles.productFragments} aria-label="WorkPulse product interface previews">
    <article className={`${styles.productFragment} ${styles.employeeFragment}`}><div className={styles.fragmentHeader}><span><UsersRound size={15} /> Employee record</span><span className={styles.statusChip}>Active</span></div><div className={styles.fragmentPerson}><span>EV</span><div><strong>Elena Vance</strong><small>Information Technology</small></div></div><div className={styles.fragmentRow}><span>Employment status</span><strong>Regular</strong></div></article>
    <article className={`${styles.productFragment} ${styles.attendanceFragment}`}><div className={styles.fragmentHeader}><span><Clock3 size={15} /> Attendance</span><small>Today</small></div><div className={styles.attendanceState}><span><Check size={17} /></span><div><strong>On Time</strong><small>08:02 AM</small></div></div><div className={styles.scheduleLine}><CalendarCheck2 size={14} /><span>Weekday schedule</span></div></article>
    <article className={`${styles.productFragment} ${styles.hiringFragment}`}><div className={styles.fragmentHeader}><span><BriefcaseBusiness size={15} /> Candidate review</span><small>Hiring</small></div><div className={styles.hiringProgress}><div><Check size={13} /><span>Resume parsed</span></div><div><UserCheck size={13} /><strong>HR review required</strong></div></div></article>
    <article className={`${styles.productFragment} ${styles.leaveFragment}`}><div className={styles.fragmentHeader}><span><CalendarCheck2 size={15} /> Leave request</span><span className={styles.statusChip}>Approved</span></div><div className={styles.fragmentRow}><span>Employee self-service</span><strong>Request reviewed</strong></div></article>
  </div>;
}

function Hero({ workspaceUrl }: { workspaceUrl: string }) {
  return <section id="hero" className={styles.hero}><ProductPreview /><div className={styles.heroHeader}><div className={styles.heroMark}><span>W</span><span>WorkPulse workforce management</span></div><h1 className={styles.heroTitle}><span className={styles.heroLinePrimary}>Manage your workforce</span><span className={styles.heroLineSecondary}>all in one place.</span></h1><p className={styles.heroSubtitle}>From hiring and employee records to attendance, leave, and self-service, WorkPulse keeps workforce operations connected.</p><div className={styles.heroActions}><Link href="/request-demo" className={styles.primaryCtaBtn}>Request a demo <ArrowRight size={15} /></Link><a href={workspaceUrl} className={styles.secondaryCtaBtn}>Find your workspace <ArrowRight size={14} /></a></div></div></section>;
}

function SectionLabel({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return <p className={`${styles.sectionLabel} ${inverse ? styles.sectionLabelInverse : ''}`}>{children}</p>;
}

function RecordsSection() {
  return <section id="features" className={`${styles.section} ${styles.recordsSection}`}>
    <div className={styles.recordsFeatureLayout}>
      <div className={styles.recordsFeatureCopy}>
        <SectionLabel>Employee records</SectionLabel>
        <h2 className={styles.sectionHeading}>Keep every<br />employee record<br /><span>connected.</span></h2>
        <p className={styles.sectionParagraph}>WorkPulse keeps employment details, attendance, leave, and employee access connected in one record.</p>
      </div>
      <div className={styles.recordSystem} aria-label="Employment history, attendance, leave, and employee self-service connected to one employee record">
        <div className={styles.recordOrbit} aria-hidden="true" />
        <div className={`${styles.recordModule} ${styles.recordModuleHistory}`}><span><History size={16} strokeWidth={1.7} /></span><div><small>Employment</small><strong>History</strong></div></div>
        <div className={`${styles.recordModule} ${styles.recordModuleAttendance}`}><span><Clock3 size={16} strokeWidth={1.7} /></span><div><small>Attendance</small><strong>On Time</strong></div></div>
        <div className={`${styles.recordModule} ${styles.recordModuleLeave}`}><span><CalendarCheck2 size={16} strokeWidth={1.7} /></span><div><small>Leave</small><strong>Approved</strong></div></div>
        <div className={`${styles.recordModule} ${styles.recordModuleEss}`}><span><UserCheck size={16} strokeWidth={1.7} /></span><div><small>Self-service</small><strong>Active</strong></div></div>
        <article className={styles.recordCore}>
          <div className={styles.recordCoreHeader}><span><UsersRound size={16} strokeWidth={1.7} /></span><strong>Employee Record</strong></div>
          <div className={styles.recordCorePerson}><div className={styles.recordCoreAvatar}>EV</div><div><small>Employee</small><h3>Elena Vance</h3><p>Information Technology</p></div></div>
          <div className={styles.recordCoreDetails}><div><span>Employment</span><strong>Regular</strong></div><div><span>Schedule</span><strong>Weekday Schedule</strong></div></div>
          <div className={styles.recordCoreStatus}><span aria-hidden="true" /><p>Records connected</p></div>
        </article>
      </div>
    </div>
  </section>;
}

function LifecycleSection() {
  return <section id="lifecycle" className={`${styles.section} ${styles.lifecycleSection}`}>
    <header className={styles.lifecycleIntro}>
      <SectionLabel>Employee lifecycle</SectionLabel>
      <h2 className={styles.sectionHeading}>One employee journey,<br />connected from start to finish.</h2>
      <p className={styles.sectionParagraph}>WorkPulse keeps workforce information connected as employees move through hiring, active employment, and separation.</p>
    </header>
    <ol className={styles.lifecycleTrack} aria-label="Employee lifecycle stages">
      {lifecycleStages.map((stage, index) => <li className={`${styles.lifecycleStep} ${index === 1 ? styles.lifecycleCore : ''}`} key={stage.title}>
        <span className={styles.lifecycleNumber}>{stage.number}</span>
        <span className={styles.lifecycleMarker} aria-hidden="true" />
        <div className={styles.lifecycleContent}><h3>{stage.title}</h3><p>{stage.description}</p></div>
      </li>)}
    </ol>
  </section>;
}

function AiHiringSection() {
  const steps = [['Resume received', 'Candidate documents enter the hiring workflow.', FileSearch], ['Details extracted', 'Experience, education, and skills are organized.', ScanText], ['Requirements compared', 'Qualifications are compared with role requirements.', Fingerprint], ['Evidence reviewed', 'HR reviews the application and interview context.', UserCheck], ['People decide', 'The final hiring decision remains with your team.', Check]] as const;
  return <section className={`${styles.section} ${styles.aiSection} ${styles.revealSection}`}><div className={styles.aiLayout}><div className={styles.aiIntro}><SectionLabel inverse>AI-assisted hiring</SectionLabel><h2 className={styles.sectionHeading}>Your team keeps the final say.</h2><p className={styles.sectionParagraph}>WorkPulse uses AI to organize resume information and compare qualifications with role requirements. Hiring decisions remain with HR.</p></div><ol className={styles.aiFlow}>{steps.map(([label, copy, Icon], index) => <li key={label} className={index === steps.length - 1 ? styles.aiHumanStep : ''}><span className={styles.aiNumber}>{String(index + 1).padStart(2, '0')}</span><Icon size={20} strokeWidth={1.6} /><div><strong>{label}</strong><p>{copy}</p></div></li>)}</ol></div></section>;
}

function WorkspacePreview({ example = false }: { example?: boolean }) {
  return <div className={styles.workspacePreview}><div className={styles.workspaceChrome}><span>{example ? 'example.workpulse.com' : 'saga.workpulse.com'}</span>{example && <span className={styles.exampleLabel}>Illustrative example</span>}</div><div className={styles.workspaceBody}><div className={`${styles.workspaceLogo} ${example ? styles.exampleLogo : ''}`}>{example ? 'E' : 'S'}</div><div><small>Organization</small><strong>{example ? 'Example Organization' : 'St. Aloysius Gonzaga Academy, Inc.'}</strong></div><span className={`${styles.brandSwatch} ${example ? styles.exampleSwatch : ''}`} aria-label="Custom primary color" /></div></div>;
}

function WorkspacesSection() {
  return <section className={`${styles.section} ${styles.workspacesSection} ${styles.revealSection}`}><div className={styles.sectionIntro}><SectionLabel>Workspaces</SectionLabel><h2 className={styles.sectionHeading}>Your own WorkPulse workspace.</h2><p className={styles.sectionParagraph}>Each organization operates in its own WorkPulse workspace, with server-enforced organization boundaries.</p></div><div className={styles.workspacePanel}><div className={styles.workspacePanelHeader}><Lock size={18} /><span>Same WorkPulse platform structure. Distinct organization identity.</span></div><div className={styles.workspaceGrid}><WorkspacePreview /><WorkspacePreview example /></div><div className={styles.workspaceTraits}><span>Custom logo</span><span>Custom primary color</span><span>Organization name</span></div></div></section>;
}

function EssSection() {
  return <section className={`${styles.section} ${styles.essSection} ${styles.revealSection}`}><div className={styles.essLayout}><div className={styles.essCopy}><SectionLabel>Employee self-service</SectionLabel><h2 className={styles.sectionHeading}>Give employees a clear view of their own records.</h2><p className={styles.sectionParagraph}>Employees can review profile details, attendance, and leave requests without entering HR administration.</p><ul><li>My Profile</li><li>My Attendance</li><li>My Leave</li></ul></div><div className={styles.essPortal} aria-label="Employee self-service interface preview"><div className={styles.essPortalHeader}><strong>Employee self-service</strong><span>My workspace</span></div><nav className={styles.essTabs} aria-label="Employee self-service preview navigation"><span className={styles.essTabActive}>My Profile</span><span>My Attendance</span><span>My Leave</span></nav><div className={styles.essProfile}><div className={styles.essAvatar}>EV</div><div><strong>Elena Vance</strong><span>Employee record</span></div></div><div className={styles.essRows}><div><span>Employment</span><strong>Regular</strong></div><div><span>Attendance</span><strong className={styles.statusPositive}>On Time</strong></div><div><span>Leave</span><strong className={styles.statusPositive}>Request approved</strong></div></div></div></div></section>;
}

function SecuritySection() {
  const items = [['Tenant isolation', 'Each organization is scoped to its own WorkPulse workspace.', Lock], ['Role-based access', 'Permissions follow Organization Admin, HR Admin, Hiring Manager, and Employee roles.', KeyRound], ['Audit history', 'Sensitive actions retain an accountable history.', History], ['Server-side authorization', 'Access rules are enforced on the server.', Server]] as const;
  return <section id="security" className={`${styles.section} ${styles.securitySection} ${styles.revealSection}`}><div className={styles.editorialSplit}><div><SectionLabel>Security</SectionLabel><h2 className={styles.sectionHeading}>Security at the organization boundary.</h2></div><div className={styles.securityRows}>{items.map(([title, copy, Icon]) => <div className={styles.securityRow} key={title}><Icon size={19} strokeWidth={1.7} /><h3>{title}</h3><p>{copy}</p></div>)}</div></div></section>;
}

function OperationsSection() {
  const values = [['Connected records', 'Employee information stays connected across implemented HR workflows.'], ['Clear workflows', 'Hiring, employment, attendance, leave, and ESS follow defined processes.'], ['Controlled access', 'Users only see the information and actions available to their role.'], ['Organization identity', 'Each organization can use its own logo, display name, and brand colors.']] as const;
  return <section className={`${styles.section} ${styles.operationsSection} ${styles.revealSection}`}><div className={styles.editorialSplit}><div><SectionLabel>Workforce operations</SectionLabel><h2 className={styles.sectionHeading}>Clear records. Clear responsibilities.</h2></div><div className={styles.operationsRows}>{values.map(([title, copy]) => <div key={title}><h3>{title}</h3><p>{copy}</p></div>)}</div></div></section>;
}

function FaqSection() {
  return <section className={`${styles.section} ${styles.faqSection} ${styles.revealSection}`}><div className={styles.faqLayout}><div className={styles.faqIntro}><SectionLabel>Questions &amp; support</SectionLabel><h2 className={styles.sectionHeading}>Frequently asked questions.</h2></div><div className={styles.faqList}>{faqItems.map(([question, answer]) => <details key={question} className={styles.faqItem}><summary><span>{question}</span><span className={styles.faqIcon} aria-hidden="true" /></summary><div><p>{answer}</p></div></details>)}</div></div></section>;
}

function FinalCta({ workspaceUrl }: { workspaceUrl: string }) {
  return <section className={styles.finalCtaSection}><div className={styles.finalCtaBox}><div><p className={styles.ctaKicker}>WorkPulse</p><h2>Bring your workforce operations into one platform.</h2><p>Connect hiring, employee records, attendance, leave, and employee self-service in one WorkPulse workspace.</p><div className={styles.finalCtaActions}><Link href="/request-demo" className={styles.ctaLightBtn}>Request Demo <ArrowRight size={15} /></Link><a href={workspaceUrl} className={styles.ctaOutlineBtn}>Find Workspace / Sign In</a></div></div><div className={styles.ctaPreview} aria-hidden="true"><div className={styles.ctaPreviewBar}><span>WorkPulse</span><span>Employee record</span></div><div className={styles.ctaPreviewBody}><span>Employment</span><strong>Regular</strong><span>Attendance</span><strong>On Time</strong><span>Leave</span><strong>Request approved</strong></div></div></div></section>;
}

function Footer({ workspaceUrl }: { workspaceUrl: string }) {
  return <footer className={styles.footer}><div className={styles.footerContent}><div><Brand /><p>Connected workforce operations for every organization workspace.</p></div><nav aria-label="Footer navigation"><Link href="#features">Features</Link><Link href="#lifecycle">How It Works</Link><Link href="#security">Security</Link><Link href="/features">Modules</Link><a href={workspaceUrl}>Find Workspace</a><Link href="/request-demo">Request Demo</Link></nav></div><div className={styles.footerBottom}><span>&copy; {new Date().getFullYear()} WorkPulse</span><span>Workforce operations, connected.</span></div></footer>;
}

export default function HomePage() {
  const workspaceUrl = discoveryOrigin();
  return <div className={`wp-public-shell ${styles.page}`}><a className={styles.skipLink} href="#main-content">Skip to main content</a><LandingNavbar workspaceUrl={workspaceUrl} /><main id="main-content"><Hero workspaceUrl={workspaceUrl} /><RecordsSection /><LifecycleSection /><AiHiringSection /><WorkspacesSection /><EssSection /><SecuritySection /><OperationsSection /><FaqSection /><FinalCta workspaceUrl={workspaceUrl} /></main><Footer workspaceUrl={workspaceUrl} /></div>;
}

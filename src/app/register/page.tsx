import { CompanyRegistrationForm } from '@/features/company-registration/forms';

export default function CompanyRegistrationPage() {
  return <><div className="space-y-2"><h1 className="wp-page-title">Create your company workspace</h1><p className="text-sm text-[var(--wp-text-muted)]">Get started with WorkPulse. You will be your company’s first HR administrator.</p></div><CompanyRegistrationForm /></>;
}

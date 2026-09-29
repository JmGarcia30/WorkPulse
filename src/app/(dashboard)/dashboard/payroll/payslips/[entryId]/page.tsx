import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewPayroll } from '@/lib/permissions/rbac';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { getFinalizedPayslipForAdmin } from '@/features/payroll/payslip';
import { PayslipView } from '@/components/payroll/PayslipView';

export default async function AdminPayslipPage({ params }: { params: Promise<{ entryId: string }> }) {
  const user = await requireBackOfficeContext();
  if (!canViewPayroll(user)) notFound();
  const { entryId } = await params;
  let result;
  try {
    result = await Promise.all([getFinalizedPayslipForAdmin({ organizationId: user.organizationId, actorUserId: user.userId, entryId }), getOrganizationBranding(user.organizationId)]);
  } catch { notFound(); }
  const [payslip, branding] = result;
  if (!branding) notFound();
  return <PayslipView payslip={payslip} branding={branding} backHref={`/dashboard/payroll?period=${payslip.payroll.periodId}`} />;
}

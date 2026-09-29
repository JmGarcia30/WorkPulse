import { notFound } from 'next/navigation';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { getFinalizedPayslipForEmployee } from '@/features/payroll/payslip';
import { PayslipView } from '@/components/payroll/PayslipView';

export default async function EmployeePayslipPage({ params }: { params: Promise<{ entryId: string }> }) {
  const context = await requireEmployeeSelfContext();
  const { entryId } = await params;
  let result;
  try {
    result = await Promise.all([getFinalizedPayslipForEmployee({ organizationId: context.organization.id, userId: context.user.id, entryId }), getOrganizationBranding(context.organization.id)]);
  } catch { notFound(); }
  const [payslip, branding] = result;
  if (!branding) notFound();
  return <PayslipView payslip={payslip} branding={branding} backHref="/employee/payroll" />;
}

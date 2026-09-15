import { notFound, redirect } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewOrganizationLeave } from '@/lib/permissions/rbac';
import { getLeaveAdminRequest } from '@/features/leave/hr-queries';
import { SagaLeaveForm } from '@/components/leave/SagaLeaveForm';

export default async function HrLeaveFormPage({ params }: { params: Promise<{ requestId: string }> }) { const user = await requireBackOfficeContext(); if (!canViewOrganizationLeave(user)) redirect('/dashboard'); const { requestId } = await params; const request = await getLeaveAdminRequest(user.organizationId, requestId); if (!request) notFound(); return <SagaLeaveForm request={request} />; }

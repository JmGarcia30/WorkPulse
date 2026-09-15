import { notFound } from 'next/navigation';
import { getMyLeaveRequest } from '@/features/leave/self-queries';
import { SagaLeaveForm } from '@/components/leave/SagaLeaveForm';

export default async function EmployeeLeaveFormPage({ params }: { params: Promise<{ requestId: string }> }) { const { requestId } = await params; const request = await getMyLeaveRequest(requestId); if (!request) notFound(); return <SagaLeaveForm request={request} />; }

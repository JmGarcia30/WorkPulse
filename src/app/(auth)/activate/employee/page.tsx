import type { Metadata } from 'next';
import { ActivationForm } from '@/components/employee-self-service/ActivationForm';

export const metadata: Metadata = {
  title: 'Activate WorkPulse Account',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function EmployeeActivationPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4"><section className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-xl"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">WorkPulse Employee Portal</p><h1 className="mt-2 text-2xl font-black">Activate your account</h1><p className="mt-2 text-sm text-slate-500">Create your password to access your employment and attendance information.</p></div><ActivationForm /></section></main>;
}

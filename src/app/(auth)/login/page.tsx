'use client';

import { useState, useTransition } from 'react';
import { loginAction } from '@/lib/auth/actions';
import { Briefcase, ShieldCheck, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.append('email', email);
    formData.append('password', password);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setError(null);

    const formData = new FormData();
    formData.append('email', quickEmail);
    formData.append('password', quickPass);

    startTransition(async () => {
      const res = await loginAction(formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#FFFFFF] via-[#ECEFF3] to-[#E2E6EC] px-4 py-12 relative overflow-hidden">
      {/* Abstract Background Waves (matching reference image backdrop) */}
      <div className="absolute inset-0 pointer-events-none opacity-60">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 rounded-full bg-white blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-8 rounded-3xl border border-[#E5E7EB] bg-white p-8 shadow-xl relative z-10">
        <div className="text-center space-y-2">
          <div className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#181A1C] text-white shadow-md">
            <Briefcase className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#22C55E] border-2 border-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#181A1C]">
            WorkPulse HR Portal
          </h1>
          <p className="text-xs font-medium text-[#6B7280]">
            St. Aloysius Gonzaga Academy, Inc. • Recruitment Foundation
          </p>
        </div>

        {/* Quick Demo Credentials */}
        <div className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] p-4 space-y-2.5">
          <span className="text-[11px] font-extrabold text-[#181A1C] uppercase tracking-wider flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#22C55E]" /> Quick Test Logins
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('hr@staloysius.edu', 'Hr123!')}
              className="flex flex-col items-center justify-center rounded-xl border border-[#E8EAED] bg-white p-2.5 text-center hover:border-[#181A1C] hover:bg-[#F8F9FA] transition shadow-2xs"
            >
              <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
              <span className="mt-1 text-[11px] font-bold text-[#181A1C]">HR Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@staloysius.edu', 'Admin123!')}
              className="flex flex-col items-center justify-center rounded-xl border border-[#E8EAED] bg-white p-2.5 text-center hover:border-[#181A1C] hover:bg-[#F8F9FA] transition shadow-2xs"
            >
              <UserCheck className="h-4 w-4 text-[#181A1C]" />
              <span className="mt-1 text-[11px] font-bold text-[#181A1C]">Org Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('manager@staloysius.edu', 'Manager123!')}
              className="flex flex-col items-center justify-center rounded-xl border border-[#E8EAED] bg-white p-2.5 text-center hover:border-[#181A1C] hover:bg-[#F8F9FA] transition shadow-2xs"
            >
              <Briefcase className="h-4 w-4 text-[#F97316]" />
              <span className="mt-1 text-[11px] font-bold text-[#181A1C]">Hiring Mgr</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('hr.test@testacademy.edu', 'Test123!')}
              className="flex flex-col items-center justify-center rounded-xl border border-[#E8EAED] bg-white p-2.5 text-center hover:border-[#181A1C] hover:bg-[#F8F9FA] transition shadow-2xs"
            >
              <ShieldCheck className="h-4 w-4 text-[#22C55E]" />
              <span className="mt-1 text-[11px] font-bold text-[#181A1C]">Test Org 2</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#181A1C]">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hr@staloysius.edu"
              className="mt-1 block w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-4 py-2.5 text-xs font-semibold text-[#181A1C] placeholder-[#9CA3AF] focus:border-[#181A1C] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#181A1C]">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] px-4 py-2.5 text-xs font-semibold text-[#181A1C] placeholder-[#9CA3AF] focus:border-[#181A1C] focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#181A1C] px-4 py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#2A2E33] disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In to WorkPulse
          </button>
        </form>

        <div className="text-center pt-2">
          <a
            href="/careers"
            className="text-xs font-bold text-[#181A1C] hover:underline"
          >
            View Public Careers Portal →
          </a>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-950 p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">WorkPulse HR Portal</h1>
          <p className="text-xs text-slate-400">
            St. Aloysius Gonzaga Academy, Inc. • Recruitment Foundation
          </p>
        </div>

        {/* Quick Demo Credentials */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5">
          <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
            🚀 Quick Test Logins
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('hr@staloysius.edu', 'Hr123!')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-center hover:bg-slate-700 transition"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="mt-1 text-[11px] font-medium text-slate-200">HR Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@staloysius.edu', 'Admin123!')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-center hover:bg-slate-700 transition"
            >
              <UserCheck className="h-4 w-4 text-indigo-400" />
              <span className="mt-1 text-[11px] font-medium text-slate-200">Org Admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('manager@staloysius.edu', 'Manager123!')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-center hover:bg-slate-700 transition"
            >
              <Briefcase className="h-4 w-4 text-amber-400" />
              <span className="mt-1 text-[11px] font-medium text-slate-200">Hiring Mgr</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('hr.test@testacademy.edu', 'Test123!')}
              className="flex flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 p-2 text-center hover:bg-slate-700 transition"
            >
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
              <span className="mt-1 text-[11px] font-medium text-slate-200">Test HR Org 2</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hr@staloysius.edu"
              className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign In to WorkPulse
          </button>
        </form>

        <div className="text-center pt-2">
          <a
            href="/careers"
            className="text-xs text-slate-400 hover:text-indigo-400 underline underline-offset-4"
          >
            View Public Careers Portal →
          </a>
        </div>
      </div>
    </div>
  );
}

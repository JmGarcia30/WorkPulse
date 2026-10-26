import Link from 'next/link';
import { Banknote, ChevronRight, ReceiptText } from 'lucide-react';
import { requireEmployeeSelfContext } from '@/features/employee-self-service/context';
import { listFinalizedPayslipsForEmployee } from '@/features/payroll/payslip';

const formatDateLabel = (value: string) => {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  } catch {
    return value;
  }
};

const formatCurrency = (value: string, currency: string) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(value));

export default async function MyPayslipsPage() {
  const context = await requireEmployeeSelfContext();
  const payslips = await listFinalizedPayslipsForEmployee({
    organizationId: context.organization.id,
    userId: context.user.id,
  });

  const latestPayslip = payslips[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
          Employee Self-Service • Payroll & Compensation
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          My Payroll
        </h1>
        <p className="text-sm text-slate-500">
          Review your finalized payslips, earnings, deductions, and net pay disbursements.
        </p>
      </header>

      {/* Top Highlights if payslips exist */}
      {latestPayslip && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Latest Disbursement
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Banknote className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {formatCurrency(latestPayslip.netPay, latestPayslip.currency)}
            </div>
            <p className="text-xs text-slate-500">
              Pay Date: {formatDateLabel(latestPayslip.payDate)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Payslips on Record
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
                <ReceiptText className="h-4 w-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-slate-900 tabular-nums">
              {payslips.length} <span className="text-sm font-semibold text-slate-500">records</span>
            </div>
            <p className="text-xs text-slate-500">
              Available for viewing and printing
            </p>
          </div>
        </div>
      )}

      {/* Payslips List */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <ReceiptText className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900">Finalized Payslips</h2>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {payslips.length} finalized periods
          </span>
        </div>

        {payslips.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
              <ReceiptText className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Finalized Payslips</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
              Your payslip records will appear here as soon as HR finalizes and releases the payroll period.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payslips.map((item) => (
              <article
                key={item.entryId}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between hover:border-slate-300 transition"
              >
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-base font-bold text-slate-900">
                      {formatDateLabel(item.periodStart)} – {formatDateLabel(item.periodEnd)}
                    </span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      {item.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Disbursement Date: <strong>{formatDateLabel(item.payDate)}</strong>
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                    <div>
                      <span className="text-slate-400">Base Pay</span>
                      <p className="font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(item.basePay, item.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Gross Pay</span>
                      <p className="font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(item.grossPay, item.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Deductions</span>
                      <p className="font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(item.totalDeductions, item.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Net Pay</span>
                      <p className="text-sm font-black text-slate-900 tabular-nums">
                        {formatCurrency(item.netPay, item.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 pt-2 sm:pt-0">
                  <Link
                    href={`/employee/payroll/${item.entryId}`}
                    className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-xs font-bold text-white shadow-2xs hover:brightness-95 transition"
                  >
                    <span>View Payslip</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

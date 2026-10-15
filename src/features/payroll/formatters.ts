export function formatCurrency(
  amount: string | number | { toString: () => string } | null | undefined,
  currency = 'PHP'
): string {
  if (amount === null || amount === undefined) return '—';
  const raw = typeof amount === 'object' ? amount.toString() : amount;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(num)) return '—';

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPayrollDate(
  date: Date | string | null | undefined,
  options?: { includeYear?: boolean }
): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(options?.includeYear !== false ? { year: 'numeric' } : {}),
  }).format(d);
}

export function formatPayrollPeriodRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  if (!start || !end) return '—';
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—';

  const startFormatted = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  }).format(startDate);

  const endFormatted = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(endDate);

  return `${startFormatted} – ${endFormatted}`;
}

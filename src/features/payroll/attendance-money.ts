/** Read-only payroll transparency. Amounts are ALWAYS from stored calculation
 * snapshots, never re-estimated from rounded display quantities. */
type Shape = Record<string, unknown>;
const object = (value: unknown): Shape =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Shape : {};
const money = (value: unknown): string | null =>
  typeof value === 'string' && /^\d+(?:\.\d{1,6})?$/.test(value) ? value : null;
const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
const seconds = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export type PayrollAttendanceMoneyRow = {
  label: 'Overtime' | 'Late' | 'Undertime' | 'Unpaid absence';
  kind?: 'earning' | 'deduction';
  quantity: string | null;
  unit: string;
  rate: string | null;
  rateUnit: string | null;
  amount: string | null;
  method: string;
};

export function payrollAttendanceMoney(value: unknown): PayrollAttendanceMoneyRow[] {
  const snapshot = object(value);
  const rules = object(object(snapshot.policy).deductionRules);
  const attendance = object(snapshot.attendanceSummary);
  const rates = object(snapshot.attendanceRateBasis);
  const late = object(rules.late), undertime = object(rules.undertime), absence = object(rules.absence);
  const lateRule = String(late.rule ?? '');
  const undertimeRule = String(undertime.rule ?? '');
  const absenceRule = String(absence.rule ?? '');
  const minuteQuantity = (n: number | null) => n === null ? null : (n / 60).toFixed(2).replace(/\.00$/, '');
  const ruleRow = (label: PayrollAttendanceMoneyRow['label'], rule: string, saved: Shape, occurrence: number | null, duration: number | null): PayrollAttendanceMoneyRow => {
    const perMinute = rule === 'PER_MINUTE';
    const perHour = rule === 'PER_HOUR';
    const fixed = rule === 'FIXED_PER_OCCURRENCE';
    return {
      label,
      quantity: perMinute ? minuteQuantity(duration) : perHour ? (duration === null ? null : (duration / 3600).toFixed(2)) : fixed ? (occurrence === null ? null : String(occurrence)) : null,
      unit: perMinute ? 'minutes' : perHour ? 'hours' : fixed ? 'occurrences' : '',
      rate: perMinute || perHour || fixed ? money(saved.parameter) : null,
      rateUnit: perMinute ? 'per minute' : perHour ? 'per hour' : fixed ? 'per occurrence' : null,
      amount: money(saved.amount),
      method: rule === 'NONE' ? 'Not deducted under policy' : perMinute || perHour ? 'Time recorded by attendance' : fixed ? 'Policy amount per occurrence' : 'Details not recorded',
    };
  };
  const lateRow = ruleRow('Late', lateRule, late, count(attendance.lateOccurrences), seconds(attendance.lateSeconds));
  const undertimeRow = ruleRow('Undertime', undertimeRule, undertime, count(attendance.undertimeOccurrences), seconds(attendance.undertimeSeconds));
  const absenceDays = count(attendance.absentDays);
  const absenceRow: PayrollAttendanceMoneyRow = {
    label: 'Unpaid absence',
    quantity: absenceDays === null ? null : String(absenceDays),
    unit: 'days',
    rate: absenceRule === 'DAILY_RATE_PER_ABSENT_DAY' ? money(rates.absenceDailyRate)
      : absenceRule === 'FIXED_PER_ABSENCE' ? money(absence.parameter) : null,
    rateUnit: absenceRule === 'DAILY_RATE_PER_ABSENT_DAY' ? 'per day'
      : absenceRule === 'FIXED_PER_ABSENCE' ? 'per absence' : null,
    amount: money(absence.amount),
    method: absenceRule === 'NONE' ? 'Not deducted under policy'
      : absenceRule === 'DAILY_RATE_PER_ABSENT_DAY' ? 'Verified daily pay basis'
        : absenceRule === 'FIXED_PER_ABSENCE' ? 'Policy amount per absence' : 'Details not recorded',
  };
  const overtimeSeconds = seconds(attendance.overtimeSeconds);
  const overtimeAmount = money(rates.overtimeAmount);
  const overtimeRow: PayrollAttendanceMoneyRow = {
    label: 'Overtime',
    kind: 'earning',
    quantity: overtimeSeconds === null ? null : (overtimeSeconds / 3600).toFixed(2),
    unit: 'hours',
    rate: money(rates.overtimeHourlyRate),
    rateUnit: 'per hour',
    amount: overtimeAmount,
    method: 'Overtime from verified attendance records',
  };
  return overtimeAmount !== null ? [overtimeRow, lateRow, undertimeRow, absenceRow] : [lateRow, undertimeRow, absenceRow];
}

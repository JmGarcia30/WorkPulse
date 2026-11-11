/** Read immutable recorded earnings only. Missing historical detail stays unavailable. */
export function payrollEarningsBreakdown(value: unknown) {
  const snapshot = value as {
    statutory?: {
      reviewedInput?: { additionalEarnings?: Array<{ id: string; kind: string; amount: string; description?: string }> };
      attendanceOvertime?: string;
    };
  } | null;
  const rows = snapshot?.statutory?.reviewedInput?.additionalEarnings;
  if (!Array.isArray(rows)) return null;
  if (rows.some(row => !row || typeof row.id !== 'string' || typeof row.kind !== 'string' || typeof row.amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(row.amount))) return null;
  const recorded = rows.map(row => ({ id: row.id, description: row.description ?? row.kind.replaceAll('_', ' '), kind: row.kind, amount: row.amount }));
  const overtime = snapshot?.statutory?.attendanceOvertime;
  if (typeof overtime === 'string' && /^\d+(\.\d{1,2})?$/.test(overtime) && Number(overtime) > 0) {
    recorded.push({ id: 'AUTO_ATTENDANCE_OVERTIME', description: 'Overtime from attendance records', kind: 'OVERTIME', amount: overtime });
  }
  return recorded;
}

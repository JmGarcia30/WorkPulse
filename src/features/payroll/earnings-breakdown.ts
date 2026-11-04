/** Read immutable recorded lines only. Missing historical detail stays unavailable. */
export function payrollEarningsBreakdown(value: unknown) {
  const snapshot = value as { statutory?: { reviewedInput?: { additionalEarnings?: Array<{ id: string; kind: string; amount: string; description?: string }> } } } | null;
  const rows = snapshot?.statutory?.reviewedInput?.additionalEarnings;
  if (!Array.isArray(rows)) return null;
  if (rows.some(row => !row || typeof row.id !== 'string' || typeof row.kind !== 'string' || typeof row.amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(row.amount))) return null;
  return rows.map(row => ({ id: row.id, description: row.description ?? row.kind.replaceAll('_', ' '), kind: row.kind, amount: row.amount }));
}

export async function measureDevelopment<T>(label: string, operation: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV === 'production') return operation();
  const start = performance.now();
  try { return await operation(); }
  finally { console.info(`[WorkPulse timing] ${label}: ${(performance.now() - start).toFixed(1)}ms`); }
}

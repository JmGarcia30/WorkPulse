import PayrollPage from '../page';

export default async function PayrollSettingsPage({ searchParams }: { searchParams: Promise<{ period?: string; employee?: string }> }) {
  const params = await searchParams;
  return <PayrollPage searchParams={Promise.resolve({ ...params, tab: 'configuration' })} />;
}

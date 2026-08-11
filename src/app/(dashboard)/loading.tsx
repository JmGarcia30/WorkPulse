import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function DashboardLoading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <LoadingSpinner label="Loading Workforce Dashboard..." size="lg" />
    </div>
  );
}

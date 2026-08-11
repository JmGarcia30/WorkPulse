import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function CareerPortalLoading() {
  return (
    <div className="flex h-96 items-center justify-center">
      <LoadingSpinner label="Loading Organization Career Opportunities..." size="lg" />
    </div>
  );
}

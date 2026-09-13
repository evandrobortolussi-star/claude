import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-6" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-6" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>

      <Card>
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-40 w-full rounded-full" />
      </Card>

      <Card>
        <Skeleton className="mb-3 h-4 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>

      <Card>
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-40 w-full" />
      </Card>
    </div>
  );
}

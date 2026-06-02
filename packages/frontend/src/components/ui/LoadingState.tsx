import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';
import { Card, CardContent, CardHeader } from './Card.js';
import { Skeleton } from './Skeleton.js';

export function LoadingState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-4 p-4 lg:p-6', className)} {...props}>
      <PageSkeleton />
    </div>
  );
}

export function TableSkeletonRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  const widths = ['w-28', 'w-20', 'w-36', 'w-24', 'w-16', 'w-32', 'w-12'];

  return Array.from({ length: rows }).map((_, row) => (
    <tr key={row} className="border-b border-border">
      {Array.from({ length: columns }).map((__, col) => (
        <td key={col} className="px-4 py-3">
          <Skeleton className={cn('h-4', widths[(row + col) % widths.length])} />
        </td>
      ))}
    </tr>
  ));
}

export function PageSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-5', className)} {...props}>
      <MetricGridSkeleton count={4} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PanelSkeleton className="min-h-[360px]" />
        <PanelSkeleton className="min-h-[360px]" />
      </div>
    </div>
  );
}

export function MetricGridSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <MetricSkeleton key={index} />
      ))}
    </div>
  );
}

export function MetricSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn('overflow-hidden', className)} {...props}>
      <CardContent className="relative flex min-h-[132px] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
        <Skeleton className="mt-5 h-6 w-24" />
        <Skeleton className="pointer-events-none absolute bottom-0 right-0 h-20 w-32 translate-x-3 translate-y-3 opacity-60" />
      </CardContent>
    </Card>
  );
}

export function PanelSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={className} {...props}>
      <CardHeader>
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-7 w-20" />
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function ChartSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('relative h-[280px] overflow-hidden rounded-md', className)} {...props}>
      <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-2 px-2">
        {[42, 58, 36, 72, 64, 86, 54, 78, 46].map((height, index) => (
          <Skeleton key={index} className="flex-1" style={{ height: `${height}%` }} />
        ))}
      </div>
      <Skeleton className="absolute inset-x-2 bottom-2 h-px" />
      <Skeleton className="absolute inset-y-2 left-2 w-px" />
    </div>
  );
}

export function DonutSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('grid min-h-[292px] grid-rows-[160px_1fr] gap-4 pt-3', className)}
      {...props}
    >
      <div className="relative mx-auto h-40 w-40 rounded-full border border-border bg-surface-muted">
        <div className="absolute inset-8 rounded-full border border-border bg-surface" />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-sm" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

export function CardSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn('h-full overflow-hidden', className)} {...props}>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
        <Skeleton className="h-2 w-full" />
      </CardContent>
    </Card>
  );
}

export function DetailPageSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-5 p-4 lg:p-6', className)} {...props}>
      <div className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-subtle-foreground">
        Loading local evidence...
      </div>
      <Skeleton className="h-5 w-28" />
      <PanelSkeleton className="min-h-[160px]" />
      <MetricGridSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton className="min-h-[320px]" />
        <PanelSkeleton className="min-h-[320px]" />
      </div>
    </div>
  );
}

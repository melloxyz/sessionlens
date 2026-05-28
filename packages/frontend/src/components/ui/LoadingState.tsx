import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function LoadingState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-4 p-4 lg:p-6', className)} {...props}>
      <div className="h-7 w-40 animate-pulse rounded-md border border-border/50 bg-surface-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-lg border border-border bg-surface-muted"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-surface-muted lg:h-80" />
    </div>
  );
}

export function TableSkeletonRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return Array.from({ length: rows }).map((_, row) => (
    <tr key={row} className="border-b border-border">
      {Array.from({ length: columns }).map((__, col) => (
        <td key={col} className="px-4 py-3">
          <div className="h-4 w-24 animate-pulse rounded border border-border/40 bg-surface-muted" />
        </td>
      ))}
    </tr>
  ));
}

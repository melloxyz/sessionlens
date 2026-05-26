import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function LoadingState({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-4 p-6', className)} {...props}>
      <div className="h-8 w-40 animate-pulse rounded-xl bg-surface-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl border border-border bg-surface" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-border bg-surface" />
    </div>
  );
}

export function TableSkeletonRows({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return Array.from({ length: rows }).map((_, row) => (
    <tr key={row} className="border-b border-border">
      {Array.from({ length: columns }).map((__, col) => (
        <td key={col} className="px-5 py-4">
          <div className="h-4 w-24 animate-pulse rounded bg-surface-muted" />
        </td>
      ))}
    </tr>
  ));
}

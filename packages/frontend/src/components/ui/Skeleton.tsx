import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md border border-border/50 bg-surface-muted', className)}
      {...props}
    />
  );
}

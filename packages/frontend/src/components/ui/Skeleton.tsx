import { cn } from '../../lib/utils.js';
import type { HTMLAttributes } from 'react';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-bg-elevated', className)} {...props} />;
}

import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

export function FigureGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3', className)}
      {...props}
    />
  );
}

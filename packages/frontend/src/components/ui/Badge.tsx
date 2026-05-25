import { cn } from '../../lib/utils.js';
import type { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-accent-subtle text-accent-hover',
        variant === 'success' && 'bg-[rgba(34,197,94,0.15)] text-success',
        variant === 'warning' && 'bg-[rgba(234,179,8,0.15)] text-warning',
        variant === 'error' && 'bg-[rgba(239,68,68,0.15)] text-error',
        className,
      )}
      {...props}
    />
  );
}

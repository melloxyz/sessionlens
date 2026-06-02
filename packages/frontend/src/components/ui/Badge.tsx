import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none',
  {
    variants: {
      variant: {
        default: 'border-accent/15 bg-accent-soft text-accent',
        neutral: 'border-border bg-surface-muted text-muted-foreground',
        success: 'border-success/15 bg-success-soft text-success',
        warning: 'border-warning/15 bg-warning-soft text-warning',
        danger: 'border-danger/15 bg-danger-soft text-danger',
        info: 'border-info/15 bg-info-soft text-info',
        actual: 'border-success/15 bg-success-soft text-success',
        estimated: 'border-warning/15 bg-warning-soft text-warning',
        unknown: 'border-border bg-surface-muted text-subtle-foreground',
        real: 'border-success/15 bg-success-soft text-success',
        partial: 'border-warning/15 bg-warning-soft text-warning',
        unavailable: 'border-danger/15 bg-danger-soft text-danger',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

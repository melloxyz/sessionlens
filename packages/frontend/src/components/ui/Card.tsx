import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  variant?: 'default' | 'flat' | 'outlined' | 'figure' | 'inset' | 'elevated';
}

const cardVariants: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'border-border bg-panel text-panel-foreground shadow-[var(--shadow-card)]',
  flat: 'border-border bg-surface text-foreground shadow-none',
  outlined: 'border-border-strong bg-transparent text-foreground shadow-none',
  figure: 'border-border bg-panel text-panel-foreground shadow-none',
  inset: 'border-border bg-surface-muted text-foreground shadow-none',
  elevated:
    'border-border-strong bg-surface-elevated text-foreground shadow-[var(--shadow-floating)]',
};

export function Card({ className, interactive, variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-md border',
        cardVariants[variant],
        interactive &&
          'transition-colors duration-200 hover:border-border-strong hover:bg-surface-hover focus-within:border-border-strong focus-within:bg-surface-hover',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 pb-0', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-foreground', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card.js';
import { Badge } from './Badge.js';
import { Skeleton } from './Skeleton.js';
import { cn } from '../../lib/utils.js';

type MetricBlockTone = 'default' | 'success' | 'warning' | 'danger' | 'info';
type MetricBlockVariant = 'hero' | 'card' | 'compact' | 'inline';

interface MetricBlockProps {
  label: string;
  value: string;
  meta?: ReactNode;
  tone?: MetricBlockTone;
  icon?: LucideIcon;
  loading?: boolean;
  variant?: MetricBlockVariant;
  className?: string;
}

const toneClasses: Record<MetricBlockTone, string> = {
  default: 'border-border bg-surface-muted text-subtle-foreground',
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  danger: 'border-danger/20 bg-danger-soft text-danger',
  info: 'border-info/20 bg-info-soft text-info',
};

export function MetricBlock({
  label,
  value,
  meta,
  tone = 'default',
  icon: Icon,
  loading,
  variant = 'card',
  className,
}: MetricBlockProps) {
  if (variant === 'inline') {
    return (
      <div className={cn('flex min-w-0 items-center justify-between gap-4', className)}>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-subtle-foreground">{label}</div>
          <div className="mt-1 truncate font-mono text-sm font-semibold text-foreground">
            {loading ? '...' : value}
          </div>
        </div>
        {meta ? <Badge variant={tone === 'default' ? 'neutral' : tone}>{meta}</Badge> : null}
      </div>
    );
  }

  const isHero = variant === 'hero';
  const isCompact = variant === 'compact';

  return (
    <Card
      variant={isHero ? 'outlined' : 'flat'}
      interactive={variant !== 'hero'}
      className={cn('overflow-hidden', isHero && 'bg-surface-elevated', className)}
    >
      <CardContent
        className={cn(
          'relative flex h-full flex-col justify-between gap-4',
          isHero ? 'min-h-[220px] p-5 lg:p-6' : isCompact ? 'min-h-[116px] p-4' : 'min-h-[144px]',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-normal text-subtle-foreground">
              {label}
            </div>
            {loading ? (
              <Skeleton className={cn('mt-4', isHero ? 'h-12 w-44' : 'h-8 w-28')} />
            ) : (
              <div
                className={cn(
                  'mt-3 break-words font-mono font-semibold leading-none text-foreground tabular-nums',
                  isHero ? 'text-4xl lg:text-5xl' : isCompact ? 'text-2xl' : 'text-3xl',
                )}
              >
                {value}
              </div>
            )}
          </div>
          {Icon ? (
            <div
              className={cn(
                'grid shrink-0 place-items-center rounded-md border',
                isHero ? 'size-11' : 'size-9',
                toneClasses[tone],
              )}
            >
              <Icon className={isHero ? 'size-5' : 'size-4'} />
            </div>
          ) : null}
        </div>
        {meta ? (
          <div className="text-sm leading-6 text-muted-foreground">
            {typeof meta === 'string' ? (
              <Badge variant={tone === 'default' ? 'neutral' : tone}>{meta}</Badge>
            ) : (
              meta
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './Card.js';
import { Skeleton } from './Skeleton.js';
import { cn } from '../../lib/utils.js';

export type MetricTone = 'success' | 'warning' | 'danger' | 'info';

interface MetricTileProps {
  label: string;
  value: string;
  meta?: string;
  tone?: MetricTone;
  icon?: LucideIcon;
  loading?: boolean;
  sparkline?: boolean;
  className?: string;
  compact?: boolean;
  iconVariant?: 'tone' | 'neutral';
  valueClassName?: string;
  valueWrap?: boolean;
}

const toneMap: Record<MetricTone, string> = {
  success: 'border-success/20 bg-success-soft text-success',
  warning: 'border-warning/20 bg-warning-soft text-warning',
  danger: 'border-danger/20 bg-danger-soft text-danger',
  info: 'border-info/20 bg-info-soft text-info',
};

export function MetricTile({
  label,
  value,
  meta,
  tone = 'success',
  icon: Icon,
  loading,
  sparkline,
  className,
  compact,
  iconVariant = 'tone',
  valueClassName,
  valueWrap,
}: MetricTileProps) {
  const isCompact = Boolean(compact);

  return (
    <Card interactive className={cn('overflow-hidden', className)}>
      <CardContent
        className={cn(
          'relative flex flex-col justify-between',
          isCompact ? 'min-h-[116px] p-4' : 'min-h-[140px] p-5',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={cn('min-w-0', isCompact ? 'space-y-2' : 'space-y-3')}>
            <p
              className={cn(
                'truncate text-xs font-medium uppercase text-subtle-foreground',
                isCompact ? 'text-[11px]' : 'text-xs',
              )}
            >
              {label}
            </p>
            {loading ? (
              <Skeleton className={isCompact ? 'h-7 w-24' : 'h-9 w-28'} />
            ) : (
              <div
                className={cn(
                  valueWrap ? 'whitespace-normal break-words' : 'truncate',
                  'font-semibold leading-none text-foreground',
                  isCompact ? 'text-[1.55rem]' : 'text-[1.9rem]',
                  valueClassName,
                )}
              >
                {value}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                'grid shrink-0 place-items-center rounded-full border',
                isCompact ? 'h-8 w-8' : 'h-10 w-10',
                iconVariant === 'neutral'
                  ? 'border-border bg-transparent text-subtle-foreground'
                  : toneMap[tone],
              )}
            >
              <Icon className={cn(isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            </div>
          )}
        </div>

        {(meta || loading) && (
          <div
            className={cn(
              'relative z-10 w-fit rounded-full border font-medium leading-none',
              isCompact ? 'mt-3 px-2 py-1 text-xs' : 'mt-5 px-2.5 py-1 text-xs',
              toneMap[tone],
            )}
          >
            {loading ? (
              <Skeleton
                className={
                  isCompact
                    ? 'h-2.5 w-16 border-current/20 bg-current/10'
                    : 'h-3 w-20 border-current/20 bg-current/10'
                }
              />
            ) : (
              meta
            )}
          </div>
        )}
        {sparkline && (
          <svg
            className={cn(
              'pointer-events-none absolute bottom-0 right-0 translate-x-3 translate-y-3 opacity-[0.14]',
              isCompact ? 'h-16 w-28' : 'h-20 w-32',
            )}
            viewBox="0 0 128 80"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 60L19 50L34 56L49 34L64 40L80 23L96 31L124 10"
              stroke="currentColor"
              className="text-accent"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M4 60L19 50L34 56L49 34L64 40L80 23L96 31L124 10V80H4V60Z"
              className="fill-accent"
              opacity="0.18"
            />
          </svg>
        )}
      </CardContent>
    </Card>
  );
}

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/Card.js';
import { Skeleton } from './ui/Skeleton.js';
import { cn } from '../lib/utils.js';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeTone?: 'success' | 'warning' | 'danger' | 'info';
  icon?: LucideIcon;
  loading?: boolean;
  sparkline?: boolean;
}

const toneMap = {
  success: 'text-success bg-success-soft',
  warning: 'text-warning bg-warning-soft',
  danger: 'text-danger bg-danger-soft',
  info: 'text-info bg-info-soft',
};

export function StatCard({
  label,
  value,
  change,
  changeTone = 'success',
  icon: Icon,
  loading,
  sparkline,
}: StatCardProps) {
  return (
    <Card interactive className="overflow-hidden">
      <CardContent className="relative flex min-h-[148px] flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-3">
            <p className="truncate text-xs font-medium uppercase tracking-[0.14em] text-subtle-foreground">
              {label}
            </p>
            {loading ? (
              <Skeleton className="h-10 w-28" />
            ) : (
              <div className="truncate text-[2rem] font-semibold leading-none tracking-[-0.055em] text-foreground">
                {value}
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-current/10',
                toneMap[changeTone],
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
        </div>

        {change && (
          <div
            className={cn(
              'relative z-10 mt-5 w-fit rounded-full px-2.5 py-1 text-xs font-medium',
              toneMap[changeTone],
            )}
          >
            {change}
          </div>
        )}
        {sparkline && (
          <svg
            className="pointer-events-none absolute bottom-0 right-0 h-20 w-32 translate-x-3 translate-y-3 opacity-[0.16]"
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

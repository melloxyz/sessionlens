import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Info } from 'lucide-react';
import { Badge } from './Badge.js';
import { cn } from '../../lib/utils.js';

interface AlertStripProps extends HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
}

const toneClass = {
  info: 'border-info/25 bg-info-soft text-info',
  success: 'border-success/25 bg-success-soft text-success',
  warning: 'border-warning/25 bg-warning-soft text-warning',
  danger: 'border-danger/25 bg-danger-soft text-danger',
};

export function AlertStrip({
  tone = 'info',
  icon,
  title,
  description,
  action,
  badge,
  className,
  ...props
}: AlertStripProps) {
  const Icon = icon ?? (tone === 'info' ? Info : AlertTriangle);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        toneClass[tone],
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <div className="font-semibold text-foreground">{title}</div>
          {description ? (
            <div className="mt-1 text-sm leading-6 text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {badge ? <Badge variant={tone}>{badge}</Badge> : null}
        {action}
      </div>
    </div>
  );
}

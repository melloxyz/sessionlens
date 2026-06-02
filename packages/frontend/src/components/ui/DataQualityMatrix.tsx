import type { HTMLAttributes } from 'react';
import { Badge } from './Badge.js';
import { cn } from '../../lib/utils.js';

export type DataQualityState =
  | 'real'
  | 'partial'
  | 'estimated'
  | 'heuristic'
  | 'unavailable'
  | 'unknown';

interface DataQualityItem {
  label: string;
  state: DataQualityState;
  detail?: string;
}

interface DataQualityMatrixProps extends HTMLAttributes<HTMLDivElement> {
  items: DataQualityItem[];
}

const stateVariant: Record<
  DataQualityState,
  'real' | 'partial' | 'estimated' | 'warning' | 'unavailable' | 'unknown'
> = {
  real: 'real',
  partial: 'partial',
  estimated: 'estimated',
  heuristic: 'warning',
  unavailable: 'unavailable',
  unknown: 'unknown',
};

export function DataQualityMatrix({ items, className, ...props }: DataQualityMatrixProps) {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)} {...props}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-2"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-foreground">{item.label}</div>
            {item.detail ? (
              <div className="mt-0.5 truncate text-[11px] text-subtle-foreground">
                {item.detail}
              </div>
            ) : null}
          </div>
          <Badge variant={stateVariant[item.state]}>{item.state}</Badge>
        </div>
      ))}
    </div>
  );
}

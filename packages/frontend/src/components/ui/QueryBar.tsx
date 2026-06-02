import type { HTMLAttributes, ReactNode } from 'react';
import { Card, CardContent } from './Card.js';
import { Badge } from './Badge.js';
import { cn } from '../../lib/utils.js';

interface QueryChip {
  key: string;
  label: string;
  onClear?: () => void;
}

interface QueryBarProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  chips?: QueryChip[];
  actions?: ReactNode;
}

export function QueryBar({
  title,
  description,
  chips = [],
  actions,
  className,
  children,
  ...props
}: QueryBarProps) {
  return (
    <Card variant="outlined" {...props}>
      <CardContent className={cn('flex flex-col gap-4 p-4', className)}>
        {(title || description || actions) && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
              {description ? (
                <p className="mt-1 text-xs leading-5 text-subtle-foreground">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) =>
              chip.onClear ? (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.onClear}
                  className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/30"
                >
                  <span>{chip.label}</span>
                  <span aria-hidden="true" className="text-subtle-foreground">
                    x
                  </span>
                </button>
              ) : (
                <Badge key={chip.key} variant="neutral">
                  {chip.label}
                </Badge>
              ),
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

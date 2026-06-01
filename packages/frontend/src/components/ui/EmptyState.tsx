import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SearchX } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function EmptyState({
  title,
  description,
  icon: Icon = SearchX,
  action,
  className,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-border bg-surface-muted/55 p-8 text-center',
        className,
      )}
    >
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-elevated text-subtle-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-base font-semibold text-foreground">{title}</div>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-subtle-foreground">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

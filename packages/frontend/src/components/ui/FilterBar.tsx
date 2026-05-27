import type { HTMLAttributes, ReactNode } from 'react';
import { Card, CardContent } from './Card.js';
import { cn } from '../../lib/utils.js';

interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  actions?: ReactNode;
}

export function FilterBar({ actions, className, children, ...props }: FilterBarProps) {
  return (
    <Card {...props}>
      <CardContent
        className={cn(
          'flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between',
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center">
          {children}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </CardContent>
    </Card>
  );
}

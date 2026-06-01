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
          'flex flex-col gap-2.5 p-3 lg:flex-row lg:items-end lg:justify-between',
          className,
        )}
      >
        <div className="flex min-w-0 w-full flex-1 flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
          {children}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

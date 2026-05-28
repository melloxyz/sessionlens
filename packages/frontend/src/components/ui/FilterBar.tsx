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
          'flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between',
          className,
        )}
      >
        <div className="flex min-w-0 w-full flex-1 flex-col gap-2 md:flex-row md:items-center">
          {children}
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
            {actions}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

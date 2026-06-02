import type { HTMLAttributes, ReactNode } from 'react';
import { Card, CardContent, CardHeader } from './Card.js';
import { Badge } from './Badge.js';
import { cn } from '../../lib/utils.js';

interface FigurePanelProps extends HTMLAttributes<HTMLDivElement> {
  figure: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  action?: ReactNode;
  contentClassName?: string;
}

export function FigurePanel({
  figure,
  title,
  description,
  meta,
  action,
  contentClassName,
  className,
  children,
  ...props
}: FigurePanelProps) {
  return (
    <Card variant="figure" className={cn('overflow-hidden', className)} {...props}>
      <CardHeader className="border-b border-border pb-4">
        <div className="flex w-full flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral" className="font-mono">
                {figure}
              </Badge>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              {meta}
            </div>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0 self-start">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn('p-4 lg:p-5', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

import type { HTMLAttributes, ReactNode } from 'react';
import { Card, CardContent, CardHeader } from './Card.js';
import { SectionHeader } from './SectionHeader.js';
import { cn } from '../../lib/utils.js';

interface DataPanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  contentClassName?: string;
  variant?: 'default' | 'flat' | 'outlined' | 'figure' | 'inset' | 'elevated';
}

export function DataPanel({
  title,
  description,
  eyebrow,
  action,
  contentClassName,
  variant,
  className,
  children,
  ...props
}: DataPanelProps) {
  const hasHeader = title || description || eyebrow || action;

  return (
    <Card variant={variant} className={className} {...props}>
      {hasHeader && (
        <CardHeader>
          <SectionHeader
            title={title ?? ''}
            description={description}
            eyebrow={eyebrow}
            action={action}
            className="w-full"
          />
        </CardHeader>
      )}
      <CardContent className={cn(hasHeader && 'pt-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}

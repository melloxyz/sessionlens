import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.js';

interface SectionHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-subtle-foreground">
            {eyebrow}
          </div>
        )}
        <h2 className="truncate font-mono text-sm font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-xs leading-5 text-subtle-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

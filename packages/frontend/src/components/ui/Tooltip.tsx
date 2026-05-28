import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.js';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-[90] max-w-64 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-strong bg-surface-elevated px-2.5 py-1.5 font-mono text-[11px] font-medium text-foreground opacity-0 shadow-[0_18px_48px_rgba(0,0,0,0.24),0_4px_14px_rgba(0,0,0,0.16)] transition duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
        <span
          className={cn(
            'absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-border-strong bg-surface-elevated',
            side === 'top' ? '-bottom-1 border-b border-r' : '-top-1 border-l border-t',
          )}
        />
      </span>
    </span>
  );
}

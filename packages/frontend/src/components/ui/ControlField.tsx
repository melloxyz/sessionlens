import type { ReactNode } from 'react';
import { cn } from '../../lib/utils.js';

interface ControlFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function ControlField({ label, children, className }: ControlFieldProps) {
  return (
    <label className={cn('space-y-1', className)}>
      <span className="block text-[10px] font-medium uppercase text-subtle-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

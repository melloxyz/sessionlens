import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils.js';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
}

export function Select({ className, options, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-10 rounded-xl border border-border bg-surface px-3 pr-8 text-sm text-foreground shadow-sm outline-none transition-all duration-200 hover:bg-surface-hover focus:border-accent/60 focus:ring-4 focus:ring-accent/10',
        className,
      )}
      {...props}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

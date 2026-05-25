import { cn } from '../../lib/utils.js';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
}

export function Select({ className, options, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'flex h-9 rounded-lg border border-border-primary bg-bg-tertiary px-3 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent transition-colors appearance-none cursor-pointer',
        className,
      )}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

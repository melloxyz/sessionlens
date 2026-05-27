import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: { label: string; value: string }[];
}

export function Select({ className, options, ...props }: SelectProps) {
  return (
    <div className="relative inline-flex min-w-[10rem]">
      <select
        className={cn(
          'h-10 w-full appearance-none rounded-xl border border-border bg-surface py-0 pl-3 pr-10 text-sm text-foreground shadow-sm outline-none transition-all duration-200 hover:bg-surface-hover focus:border-accent/60 focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
    </div>
  );
}

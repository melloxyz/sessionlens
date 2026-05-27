import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils.js';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-surface px-3 font-mono text-sm text-foreground outline-none transition-colors duration-150 placeholder:text-subtle-foreground hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

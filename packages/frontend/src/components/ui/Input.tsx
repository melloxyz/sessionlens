import { cn } from '../../lib/utils.js';
import { type InputHTMLAttributes, forwardRef } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-lg border border-border-primary bg-bg-tertiary px-3 py-1 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent transition-colors',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

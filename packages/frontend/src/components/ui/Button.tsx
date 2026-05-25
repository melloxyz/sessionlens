import { cn } from '../../lib/utils.js';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-accent text-white hover:bg-accent-hover',
          variant === 'ghost' && 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
          variant === 'outline' && 'border border-border-primary bg-transparent hover:bg-bg-hover text-text-primary',
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-10 px-4 text-sm',
          size === 'lg' && 'h-12 px-6 text-sm',
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

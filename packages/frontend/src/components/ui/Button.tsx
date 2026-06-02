import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-accent bg-accent text-accent-foreground hover:bg-accent-hover',
        secondary:
          'border-border bg-surface text-foreground shadow-[var(--shadow-card)] hover:border-border-strong hover:bg-surface-hover',
        outline:
          'border-border bg-transparent text-foreground hover:border-border-strong hover:bg-surface-hover',
        ghost:
          'border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground',
        subtle: 'border-accent/20 bg-accent-soft text-accent hover:border-accent/40',
        danger: 'border-danger bg-danger text-white hover:bg-danger/90',
        command:
          'border-border-strong bg-surface-elevated text-foreground shadow-[var(--shadow-card)] hover:bg-surface-hover',
        critical:
          'border-danger/30 bg-danger-soft text-danger hover:border-danger/50 hover:bg-danger/15',
        quiet: 'border-transparent bg-transparent text-subtle-foreground hover:text-foreground',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-5',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);

Button.displayName = 'Button';

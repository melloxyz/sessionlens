import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cn } from '../../lib/utils.js';

interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  density?: 'default' | 'compact';
}

export function DataTable({ className, density = 'default', ...props }: DataTableProps) {
  return (
    <table
      className={cn(
        'w-full border-separate border-spacing-0 text-sm',
        density === 'compact' && 'text-[13px]',
        className,
      )}
      {...props}
    />
  );
}

export function DataTableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-x-auto rounded-md', className)} {...props} />;
}

export function DataTableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />;
}

export function DataTableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function DataTableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors duration-150 hover:bg-surface-hover focus-within:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/20',
        className,
      )}
      {...props}
    />
  );
}

export function DataTableHeaderCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-left text-xs font-medium uppercase text-subtle-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...props} />;
}

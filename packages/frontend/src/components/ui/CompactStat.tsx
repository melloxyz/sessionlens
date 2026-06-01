import { cn } from '../../lib/utils.js';

interface CompactStatProps {
  label: string;
  value: string;
  meta?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  valueClassName?: string;
}

const toneMap: Record<NonNullable<CompactStatProps['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function CompactStat({
  label,
  value,
  meta,
  tone = 'default',
  className,
  valueClassName,
}: CompactStatProps) {
  return (
    <div className={cn('rounded-md border border-border bg-surface-muted px-4 py-3', className)}>
      <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
      <div className={cn('mt-1.5 truncate text-sm font-semibold', toneMap[tone], valueClassName)}>
        {value}
      </div>
      {meta ? <div className="mt-1 text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  );
}

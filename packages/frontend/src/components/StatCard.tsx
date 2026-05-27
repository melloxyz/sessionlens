import type { LucideIcon } from 'lucide-react';
import { MetricTile } from './ui/MetricTile.js';

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeTone?: 'success' | 'warning' | 'danger' | 'info';
  icon?: LucideIcon;
  loading?: boolean;
  sparkline?: boolean;
}

export function StatCard({
  label,
  value,
  change,
  changeTone = 'success',
  icon: Icon,
  loading,
  sparkline,
}: StatCardProps) {
  return (
    <MetricTile
      label={label}
      value={value}
      meta={change}
      tone={changeTone}
      icon={Icon}
      loading={loading}
      sparkline={sparkline}
    />
  );
}

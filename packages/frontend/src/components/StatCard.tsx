import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/Card.js';
import { Skeleton } from './ui/Skeleton.js';

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: LucideIcon;
  loading?: boolean;
}

export function StatCard({ label, value, subtitle, icon: Icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p className="text-2xl font-semibold text-text-primary">{value}</p>
          )}
          {subtitle && <p className="text-xs text-text-tertiary">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle">
            <Icon className="h-4 w-4 text-accent-hover" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { CalendarDays, Database, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDateRange } from '../filters/DateRangeProvider.js';
import { useI18n } from '../i18n/LanguageProvider.js';
import { Button } from '../ui/Button.js';
import { Select } from '../ui/Select.js';
import { Badge } from '../ui/Badge.js';
import { useApi } from '../../hooks/useApi.js';
import type { IntegrationStatusItem } from '../layout/IntegrationStatus.js';

interface TopbarProps {
  section: string;
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  showDateRange?: boolean;
}

export function Topbar({ section, title, subtitle, onRefresh, showDateRange }: TopbarProps) {
  const { t } = useI18n();
  const { range, setRange } = useDateRange();
  const { data } = useApi<{ integrations: IntegrationStatusItem[] }>('/api/integrations/status', {
    initialData: { integrations: [] },
  });
  const availableSources = (data?.integrations ?? []).filter((item) => item.status === 'available');

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/92 px-4 py-3 backdrop-blur lg:px-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-subtle-foreground">
            <span className="font-mono text-foreground">ÁREA {section}</span>
            <span>/</span>
            <span>SESSIONLENS</span>
          </div>
          <h1 className="truncate text-2xl font-semibold leading-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
          <Link to="/sources" tabIndex={-1}>
            <Badge
              variant={availableSources.length > 0 ? 'success' : 'warning'}
              className="h-9 cursor-pointer justify-center gap-1.5 rounded-md px-3 transition-opacity hover:opacity-80"
              title="View all sources"
            >
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-semibold">{availableSources.length}</span>{' '}
                <span className="font-normal opacity-80">
                  {availableSources.length === 1 ? 'source' : 'sources'} detected
                </span>
              </span>
            </Badge>
          </Link>
          {showDateRange && (
            <div className="relative flex min-w-[172px] items-center">
              <CalendarDays className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-subtle-foreground" />
              <Select
                value={range}
                onChange={(event) => setRange(event.target.value as typeof range)}
                className="min-w-[172px] pl-9"
                options={[
                  { label: t('common.last7'), value: '7d' },
                  { label: t('common.last30'), value: '30d' },
                  { label: t('common.last90'), value: '90d' },
                  { label: t('common.allTime'), value: 'all' },
                ]}
              />
            </div>
          )}
          <Button variant="command" size="icon" aria-label="Refresh" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

import { CalendarDays, Filter, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/LanguageProvider.js';
import { Button } from '../ui/Button.js';
import { ThemeToggle } from '../theme/ThemeToggle.js';

interface TopbarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
}

export function Topbar({ title, subtitle, onRefresh }: TopbarProps) {
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-4 border-b border-border bg-background/88 px-6 backdrop-blur-xl">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Button variant="outline" className="text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {t('common.last30')}
        </Button>
        <Button variant="outline" className="text-muted-foreground">
          <Filter className="h-4 w-4" />
          {t('common.filter')}
        </Button>
        <Button variant="outline" size="icon" aria-label="Refresh" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

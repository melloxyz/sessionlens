import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  CircleDot,
  Command,
  History,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  Moon,
  PackageOpen,
  Settings,
  Sun,
  Github,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n/LanguageProvider.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { useApi } from '../../hooks/useApi.js';
import { cn } from '../../lib/utils.js';
import type { IntegrationStatusItem } from './IntegrationStatus.js';
import { BrandMark, getBrandMeta } from '../brand/BrandMark.js';

const NAV_ITEMS: {
  to: string;
  labelKey:
    | 'nav.dashboard'
    | 'nav.sessions'
    | 'nav.projects'
    | 'nav.models'
    | 'nav.analytics'
    | 'nav.budgets';
  icon: LucideIcon;
}[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/sessions', labelKey: 'nav.sessions', icon: MessageSquare },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderOpen },
  { to: '/models', labelKey: 'nav.models', icon: PackageOpen },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/budgets', labelKey: 'nav.budgets', icon: WalletCards },
];

export function Sidebar() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { data } = useApi<{ integrations: IntegrationStatusItem[] }>('/api/integrations/status', {
    initialData: { integrations: [] },
  });

  const integrations = (data?.integrations ?? [])
    .filter((item) => item.status === 'available')
    .map((item) => ({ ...item, label: getBrandMeta(item.cli, 'cli').label }));

  return (
    <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-border bg-canvas lg:flex">
      <div className="flex h-18 items-center gap-3 border-b border-border px-4">
        <img
          src={theme === 'dark' ? '/sessionlens-white-logo.png' : '/sessionlens-black-logo.png'}
          alt="Sessionlens"
          className="h-11 w-11 rounded-md"
        />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-foreground">Sessionlens</div>
          <div className="text-xs text-muted-foreground">Local AI CLI observability</div>
        </div>
      </div>

      <nav className="space-y-1 px-3 py-5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex h-9 items-center gap-3 rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25',
                isActive
                  ? 'border-border bg-surface text-foreground shadow-[var(--shadow-card)]'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-surface hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute left-1.5 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-transparent transition-colors',
                    isActive && 'bg-accent',
                  )}
                />
                <item.icon
                  className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-accent')}
                />
                <span className={cn('transition-colors', isActive && 'text-foreground')}>
                  {t(item.labelKey)}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-3 px-4">
        <div className="mb-3 text-xs font-semibold uppercase text-subtle-foreground">
          Integrations
        </div>
        <div className="space-y-1">
          {integrations.map((item) => (
            <button
              type="button"
              key={item.label}
              className="flex h-9 w-full items-center justify-between rounded-md border border-transparent px-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-surface hover:text-foreground"
              onClick={async () => {
                await fetch(`/api/integrations/${item.cli}/open`, { method: 'POST' });
              }}
              title={item.path ?? item.label}
            >
              <div className="flex items-center gap-2.5">
                <BrandMark value={item.cli} size="sm" />
                <span>{item.label}</span>
              </div>
              <CircleDot
                className={cn(
                  'h-3 w-3',
                  item.status === 'available'
                    ? 'fill-success text-success'
                    : 'fill-muted-foreground text-muted-foreground',
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto p-3">
        <div className="mb-3 rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Command className="h-3.5 w-3.5" />
            {t('sidebar.localFirst')}
          </div>
          {t('sidebar.localFirst.description')}
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-full border border-border bg-surface p-1 shadow-[var(--shadow-card)]">
          <NavLink
            to="/settings"
            className="grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </NavLink>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <NavLink
            to="/changelog"
            className="grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label="Changelog"
          >
            <History className="h-4 w-4" />
          </NavLink>
          <a
            href="https://github.com/melloxyz/sessionlens"
            target="_blank"
            rel="noreferrer"
            className="grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  const { t } = useI18n();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-6 gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-md border text-[10px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25',
                isActive
                  ? 'border-transparent bg-surface-hover text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-surface-hover hover:text-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CircleDot,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  PackageOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n/LanguageProvider.js';
import { useApi } from '../../hooks/useApi.js';
import { cn } from '../../lib/utils.js';
import type { IntegrationStatusItem } from './IntegrationStatus.js';
import { BrandMark, getBrandMeta } from '../brand/BrandMark.js';

const NAV_ITEMS: { to: string; labelKey: 'nav.dashboard' | 'nav.sessions' | 'nav.projects' | 'nav.models' | 'nav.analytics' | 'nav.settings'; icon: LucideIcon }[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { to: '/sessions', labelKey: 'nav.sessions', icon: MessageSquare },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderOpen },
  { to: '/models', labelKey: 'nav.models', icon: PackageOpen },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3 },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings },
];

export function Sidebar() {
  const { t } = useI18n();
  const { data } = useApi<{ integrations: IntegrationStatusItem[] }>('/api/integrations/status', { initialData: { integrations: [] } });

  const integrations = (data?.integrations ?? [])
    .map((item) => ({ ...item, label: getBrandMeta(item.cli, 'cli').label }));

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-border bg-surface/72 backdrop-blur-xl lg:flex">
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="grid h-9 w-9 place-items-center rounded-2xl bg-accent-soft text-accent ring-1 ring-accent/15">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-[-0.02em] text-foreground">AIMeter</div>
          <div className="text-[11px] text-subtle-foreground">local observability</div>
        </div>
      </div>

      <nav className="space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => cn(
              'group flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-all duration-200',
              isActive
                ? 'bg-accent-soft text-accent shadow-sm ring-1 ring-accent/10'
                : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 px-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle-foreground">Integrations</div>
        <div className="space-y-2">
          {integrations.length > 0 ? integrations.map((item) => (
            <div key={item.label} className="flex items-center justify-between rounded-xl px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
              <div className="flex items-center gap-3">
                <BrandMark value={item.cli} size="sm" />
                <span>{item.label}</span>
              </div>
              <CircleDot className={cn('h-3.5 w-3.5', item.status === 'available' ? 'fill-success text-success' : 'fill-muted-foreground text-muted-foreground')} />
            </div>
          )) : ['claude', 'codex', 'opencode'].map((cli) => (
            <div key={cli} className="flex items-center justify-between rounded-xl px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
              <div className="flex items-center gap-3">
                <BrandMark value={cli} size="sm" />
                <span>{getBrandMeta(cli, 'cli').label}</span>
              </div>
              <CircleDot className="h-3.5 w-3.5 fill-success text-success" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-4 p-4">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">DEV</div>
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-foreground">Development build</div>
              <div className="text-[11px] text-subtle-foreground">v0.0.1 local</div>
            </div>
          </div>
          <NavLink to="/settings" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
}

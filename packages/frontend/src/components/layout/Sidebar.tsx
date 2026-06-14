import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Command,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Moon,
  PackageOpen,
  Settings,
  Sun,
  Github,
  UserRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useI18n } from '../i18n/LanguageProvider.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { usePrivacy } from '../privacy/PrivacyProvider.js';
import { cn } from '../../lib/utils.js';

type NavLabelKey =
  | 'nav.dashboard'
  | 'nav.sessions'
  | 'nav.projects'
  | 'nav.models'
  | 'nav.analytics'
  | 'nav.budgets'
  | 'nav.sources'
  | 'nav.profile';

const NAV_ITEMS: {
  to: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  code: string;
}[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, code: '01' },
  { to: '/sessions', labelKey: 'nav.sessions', icon: MessageSquare, code: '02' },
  { to: '/projects', labelKey: 'nav.projects', icon: FolderOpen, code: '03' },
  { to: '/analytics', labelKey: 'nav.analytics', icon: BarChart3, code: '04' },
  { to: '/models', labelKey: 'nav.models', icon: PackageOpen, code: '05' },
  { to: '/budgets', labelKey: 'nav.budgets', icon: WalletCards, code: '06' },
  { to: '/sources', labelKey: 'nav.sources', icon: Layers, code: '07' },
];

const MOBILE_NAV_ITEMS = [
  ...NAV_ITEMS,
  { to: '/profile', labelKey: 'nav.profile' as const, icon: UserRound, code: '09' },
];

export function Sidebar() {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { isPrivate, togglePrivacy } = usePrivacy();

  return (
    <aside className="hidden h-full w-[276px] shrink-0 flex-col border-r border-border bg-canvas lg:flex">
      <div className="flex h-22 items-center gap-3 border-b border-border px-4">
        <img
          src={theme === 'dark' ? '/sessionlens-white-logo.png' : '/sessionlens-black-logo.png'}
          alt="Sessionlens"
          className="h-11 w-11 rounded-md border border-border bg-surface"
        />
        <div className="min-w-0">
          <div className="text-lg font-semibold text-foreground">Sessionlens</div>
          <div className="font-mono text-[11px] uppercase text-muted-foreground">
            {t('sidebar.controlPlane')}
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3 py-5">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase text-subtle-foreground">
          {t('sidebar.stack')}
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex min-h-10 items-center gap-3 rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25',
                isActive
                  ? 'border-border-strong bg-surface text-foreground shadow-[var(--shadow-card)]'
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
                <span className="font-mono text-[11px] text-subtle-foreground">{item.code}</span>
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

      <div className="mt-auto p-3">
        <div className="mb-3 rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Command className="h-3.5 w-3.5" />
            {t('sidebar.localFirst')}
          </div>
          {t('sidebar.localFirst.description')}
        </div>
        <div className="grid grid-cols-5 gap-1 rounded-full border border-border bg-surface p-1 shadow-[var(--shadow-card)]">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground',
                isActive && 'border-accent/20 bg-accent-soft text-accent',
              )
            }
            aria-label={t('nav.settings')}
          >
            <Settings className="h-4 w-4" />
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground',
                isActive && 'border-accent/20 bg-accent-soft text-accent',
              )
            }
            aria-label={t('nav.profile')}
          >
            <UserRound className="h-4 w-4" />
          </NavLink>
          <button
            type="button"
            onClick={togglePrivacy}
            className={cn(
              'grid h-8 place-items-center rounded-full border border-transparent transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground',
              isPrivate
                ? 'border-warning/20 bg-warning-soft text-warning'
                : 'text-muted-foreground',
            )}
            aria-label={isPrivate ? 'Mostrar dados financeiros' : 'Ocultar dados financeiros'}
          >
            {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-8 place-items-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border hover:bg-surface-hover hover:text-foreground"
            aria-label={theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
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
      <div className="grid grid-cols-7 gap-1 p-2">
        {MOBILE_NAV_ITEMS.map((item) => (
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

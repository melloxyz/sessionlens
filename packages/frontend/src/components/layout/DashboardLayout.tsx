import { Outlet, useLocation } from 'react-router-dom';
import { MobileNavigation, Sidebar } from './Sidebar.js';
import { Topbar } from '../navigation/Topbar.js';
import { useI18n } from '../i18n/LanguageProvider.js';

const PAGE_KEYS: Record<
  string,
  {
    title: Parameters<ReturnType<typeof useI18n>['t']>[0];
    subtitle: Parameters<ReturnType<typeof useI18n>['t']>[0];
  }
> = {
  '/': { title: 'topbar.dashboard.title', subtitle: 'topbar.dashboard.subtitle' },
  '/sessions': { title: 'topbar.sessions.title', subtitle: 'topbar.sessions.subtitle' },
  '/projects': { title: 'topbar.projects.title', subtitle: 'topbar.projects.subtitle' },
  '/analytics': { title: 'topbar.analytics.title', subtitle: 'topbar.analytics.subtitle' },
  '/models': { title: 'topbar.models.title', subtitle: 'topbar.models.subtitle' },
  '/budgets': { title: 'topbar.budgets.title', subtitle: 'topbar.budgets.subtitle' },
  '/settings': { title: 'topbar.settings.title', subtitle: 'topbar.settings.subtitle' },
  '/changelog': { title: 'topbar.changelog.title', subtitle: 'topbar.changelog.subtitle' },
};

function getPageKeys(pathname: string) {
  if (pathname.startsWith('/sessions/'))
    return {
      title: 'topbar.sessions.title' as const,
      subtitle: 'topbar.sessions.subtitle' as const,
    };
  if (pathname.startsWith('/projects/'))
    return {
      title: 'topbar.projects.title' as const,
      subtitle: 'topbar.projects.subtitle' as const,
    };
  if (pathname.startsWith('/analytics/insights/'))
    return {
      title: 'topbar.analytics.title' as const,
      subtitle: 'topbar.analytics.subtitle' as const,
    };
  return PAGE_KEYS[pathname] ?? PAGE_KEYS['/'];
}

export function DashboardLayout() {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const page = getPageKeys(pathname);
  const showDateRange = pathname === '/' || pathname === '/sessions' || pathname === '/analytics';

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <Topbar
          title={t(page.title)}
          subtitle={t(page.subtitle)}
          showDateRange={showDateRange}
          onRefresh={() => window.location.reload()}
        />
        <div className="min-h-0 flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Outlet />
        </div>
      </main>
      <MobileNavigation />
    </div>
  );
}

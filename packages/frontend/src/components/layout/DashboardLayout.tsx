import { Outlet, useLocation } from 'react-router-dom';
import { MobileNavigation, Sidebar } from './Sidebar.js';
import { Topbar } from '../navigation/Topbar.js';
import { useI18n } from '../i18n/LanguageProvider.js';

const PAGE_KEYS: Record<
  string,
  {
    title: Parameters<ReturnType<typeof useI18n>['t']>[0];
    subtitle: Parameters<ReturnType<typeof useI18n>['t']>[0];
    section: string;
  }
> = {
  '/': { title: 'topbar.dashboard.title', subtitle: 'topbar.dashboard.subtitle', section: '01' },
  '/sessions': {
    title: 'topbar.sessions.title',
    subtitle: 'topbar.sessions.subtitle',
    section: '02',
  },
  '/projects': {
    title: 'topbar.projects.title',
    subtitle: 'topbar.projects.subtitle',
    section: '03',
  },
  '/analytics': {
    title: 'topbar.analytics.title',
    subtitle: 'topbar.analytics.subtitle',
    section: '04',
  },
  '/models': { title: 'topbar.models.title', subtitle: 'topbar.models.subtitle', section: '05' },
  '/budgets': { title: 'topbar.budgets.title', subtitle: 'topbar.budgets.subtitle', section: '06' },
  '/settings': {
    title: 'topbar.settings.title',
    subtitle: 'topbar.settings.subtitle',
    section: '07',
  },
  '/profile': {
    title: 'topbar.profile.title',
    subtitle: 'topbar.profile.subtitle',
    section: '09',
  },
};

function getPageKeys(pathname: string) {
  if (pathname.startsWith('/sessions/'))
    return {
      title: 'topbar.sessions.title' as const,
      subtitle: 'topbar.sessions.subtitle' as const,
      section: '02',
    };
  if (pathname.startsWith('/projects/'))
    return {
      title: 'topbar.projects.title' as const,
      subtitle: 'topbar.projects.subtitle' as const,
      section: '03',
    };
  if (pathname.startsWith('/analytics/insights/'))
    return {
      title: 'topbar.analytics.title' as const,
      subtitle: 'topbar.analytics.subtitle' as const,
      section: '04',
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
          section={page.section}
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

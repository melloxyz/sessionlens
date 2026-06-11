import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout.js';
import { ThemeProvider } from './components/theme/ThemeProvider.js';
import { LanguageProvider } from './components/i18n/LanguageProvider.js';
import { DateRangeProvider } from './components/filters/DateRangeProvider.js';
import { PreferencesProvider } from './components/preferences/PreferencesProvider.js';
import { LoadingState } from './components/ui/LoadingState.js';

const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.js').then((module) => ({ default: module.DashboardPage })),
);
const SessionsPage = lazy(() =>
  import('./pages/SessionsPage.js').then((module) => ({ default: module.SessionsPage })),
);
const SessionDetailPage = lazy(() =>
  import('./pages/SessionDetailPage.js').then((module) => ({
    default: module.SessionDetailPage,
  })),
);
const ProjectsPage = lazy(() =>
  import('./pages/ProjectsPage.js').then((module) => ({ default: module.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import('./pages/ProjectDetailPage.js').then((module) => ({
    default: module.ProjectDetailPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage.js').then((module) => ({ default: module.AnalyticsPage })),
);
const InsightDetailPage = lazy(() =>
  import('./pages/InsightDetailPage.js').then((module) => ({
    default: module.InsightDetailPage,
  })),
);
const ModelsPage = lazy(() =>
  import('./pages/ModelsPage.js').then((module) => ({ default: module.ModelsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage.js').then((module) => ({ default: module.SettingsPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage.js').then((module) => ({ default: module.ProfilePage })),
);
const BudgetsPage = lazy(() =>
  import('./pages/BudgetsPage.js').then((module) => ({ default: module.BudgetsPage })),
);
const ChangelogPage = lazy(() =>
  import('./pages/ChangelogPage.js').then((module) => ({ default: module.ChangelogPage })),
);

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PreferencesProvider>
          <DateRangeProvider>
            <Suspense fallback={<LoadingState />}>
              <Routes>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/sessions" element={<SessionsPage />} />
                  <Route path="/sessions/:id" element={<SessionDetailPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/analytics/insights/:id" element={<InsightDetailPage />} />
                  <Route path="/models" element={<ModelsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/changelog" element={<ChangelogPage />} />
                </Route>
              </Routes>
            </Suspense>
          </DateRangeProvider>
        </PreferencesProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

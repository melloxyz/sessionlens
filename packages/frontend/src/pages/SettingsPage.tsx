import { useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Database,
  Download,
  Globe2,
  Languages,
  LayoutList,
  List,
  LockKeyhole,
  Moon,
  Play,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react';
import { BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { usePreferences } from '../components/preferences/PreferencesProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Select } from '../components/ui/Select.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import type { IntegrationStatusItem } from '../components/layout/IntegrationStatus.js';
import { useApi, invalidateAllCaches } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime } from '../lib/format.js';
import { cn } from '../lib/utils.js';

interface Overview {
  totalSpend: number;
  sessionCount: number;
  mostUsedCli: string | null;
}

interface IngestionStatus {
  totalSessions?: number;
  newSessions?: number;
  updatedSessions?: number;
  errors?: string[];
  startedAt?: string;
  completedAt?: string | null;
  adapters?: Record<string, { detected: boolean; paths: number }>;
  message?: string;
}

interface AutoIngestionStatus {
  enabled: boolean;
  running: boolean;
  scheduled: boolean;
  watchedPathCount: number;
  debounceMs: number;
  periodicScanMs: number;
  lastTriggeredAt: string | null;
  lastTriggerReason: string | null;
  lastRunCompletedAt: string | null;
  lastError: string | null;
}

interface TrayStatus {
  enabled: boolean;
  autoStart: boolean;
  startMinimized: boolean;
  available: boolean;
}

interface AlertRow {
  id: number;
  budget_id: number | null;
  type: string;
  title: string;
  message: string;
  current_spend: number;
  limit_usd: number;
  acknowledged: number;
  created_at: string;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { preferences, updateCheck, setPreference, checkForUpdates } = usePreferences();
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [autoMutationError, setAutoMutationError] = useState<string | null>(null);
  const {
    data: overview,
    loading: overviewLoading,
    validating: overviewValidating,
    error: overviewError,
    refetch: refetchOverview,
  } = useApi<Overview>('/api/overview');
  const {
    data: ingestStatus,
    loading: ingestLoading,
    validating: ingestValidating,
    error: ingestError,
    refetch: refetchIngest,
  } = useApi<IngestionStatus>('/api/ingest/status');
  const {
    data: autoIngestion,
    loading: autoLoading,
    validating: autoValidating,
    error: autoError,
    refetch: refetchAuto,
  } = useApi<AutoIngestionStatus>('/api/ingest/auto');
  const { data: integrations, loading: integrationsLoading } = useApi<{
    integrations: IntegrationStatusItem[];
  }>('/api/integrations/status', { initialData: { integrations: [] } });
  const {
    data: trayStatus,
    loading: trayLoading,
    error: trayError,
    refetch: refetchTray,
  } = useApi<TrayStatus>('/api/tray/status');
  const [trayUpdating, setTrayUpdating] = useState(false);
  const [trayMutationError, setTrayMutationError] = useState<string | null>(null);
  const {
    data: privacySettings,
    loading: privacyLoading,
    refetch: refetchPrivacy,
  } = useApi<{ redactSensitiveData: boolean }>('/api/privacy/settings');
  const [privacyUpdating, setPrivacyUpdating] = useState(false);

  const {
    data: alertsData,
    loading: alertsLoading,
    refetch: refetchAlerts,
  } = useApi<{ alerts: AlertRow[]; total: number }>('/api/alerts', {
    initialData: { alerts: [], total: 0 },
  });

  const integrationsList = integrations?.integrations ?? [];
  const adapterRows = Object.entries(ingestStatus?.adapters ?? {});
  const unacknowledgedAlerts = (alertsData?.alerts ?? []).filter((a) => !a.acknowledged);
  const detectedCount = integrationsList.filter((item) => item.status === 'available').length;
  const isValidating = overviewValidating || ingestValidating || autoValidating;

  const topCards = useMemo(
    () => [
      {
        icon: theme === 'dark' ? Moon : Sun,
        label: t('settings.summary.theme'),
        value: theme === 'dark' ? t('settings.dark') : t('settings.light'),
        meta: t('settings.summary.active'),
      },
      {
        icon: Globe2,
        label: t('settings.summary.language'),
        value: locale === 'pt-BR' ? t('settings.portugueseBrazil') : t('settings.english'),
        meta: locale === 'pt-BR' ? 'PT-BR' : 'EN',
      },
      {
        icon: ShieldCheck,
        label: t('settings.summary.privacy'),
        value: t('settings.summary.localFirst'),
        meta: t('settings.summary.localOnly'),
      },
      {
        icon: Sparkles,
        label: t('settings.summary.integrations'),
        value: String(detectedCount),
        meta: t('settings.summary.sourcesDetected'),
      },
    ],
    [detectedCount, locale, t, theme],
  );

  async function runIngestion() {
    setIngestionRunning(true);
    try {
      await fetch('/api/ingest', { method: 'POST' });
      invalidateAllCaches();
      await Promise.all([refetchIngest(), refetchOverview(), refetchAuto()]);
    } finally {
      setIngestionRunning(false);
    }
  }

  async function setAutoIngestion(enabled: boolean) {
    setAutoUpdating(true);
    setAutoMutationError(null);
    try {
      const res = await fetch('/api/ingest/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchAuto();
    } catch (err) {
      setAutoMutationError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutoUpdating(false);
    }
  }

  async function updateTraySetting(key: string, value: boolean) {
    setTrayUpdating(true);
    setTrayMutationError(null);
    try {
      const res = await fetch('/api/tray/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error(await res.text());
      await refetchTray();
    } catch (err) {
      setTrayMutationError(err instanceof Error ? err.message : String(err));
    } finally {
      setTrayUpdating(false);
    }
  }

  async function updateRedactSetting(value: boolean) {
    setPrivacyUpdating(true);
    try {
      await fetch('/api/privacy/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redactSensitiveData: value }),
      });
      await refetchPrivacy();
    } finally {
      setPrivacyUpdating(false);
    }
  }

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-[1780px] flex-col gap-5 overflow-y-auto p-4 lg:p-6"
      aria-busy={isValidating}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card) => (
          <SettingsSummaryCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          <SettingsSection
            marker="A."
            title={t('settings.section.appearance')}
            description={t('settings.section.appearance.description')}
          >
            <ControlGroup
              title={t('settings.theme')}
              description={t('settings.theme.description')}
              className="grid gap-3 sm:grid-cols-2"
            >
              <ChoiceCard
                active={theme === 'dark'}
                icon={Moon}
                title={t('settings.dark')}
                description={t('settings.recommended')}
                onClick={() => setTheme('dark')}
              />
              <ChoiceCard
                active={theme === 'light'}
                icon={Sun}
                title={t('settings.light')}
                description={t('settings.alternative')}
                onClick={() => setTheme('light')}
              />
            </ControlGroup>

            <ControlGroup
              title={t('settings.density')}
              description={t('settings.density.description')}
              className="grid gap-3 sm:grid-cols-2"
            >
              <ChoiceCard
                active={density === 'comfortable'}
                icon={List}
                title={t('settings.density.comfortable')}
                description={t('settings.density.comfortable.description')}
                onClick={() => setDensity('comfortable')}
              />
              <ChoiceCard
                active={density === 'compact'}
                icon={LayoutList}
                title={t('settings.density.compact')}
                description={t('settings.density.compact.description')}
                onClick={() => setDensity('compact')}
              />
            </ControlGroup>

            <Card variant="inset">
              <CardContent className="divide-y divide-border p-0">
                <SwitchRow
                  title={t('settings.animations')}
                  description={t('settings.animations.description')}
                  enabled={preferences.subtleAnimations}
                  onChange={() => setPreference('subtleAnimations', !preferences.subtleAnimations)}
                />
                <SwitchRow
                  title={t('settings.compactTypography')}
                  description={t('settings.compactTypography.description')}
                  enabled={preferences.compactTypography}
                  onChange={() =>
                    setPreference('compactTypography', !preferences.compactTypography)
                  }
                />
                <SwitchRow
                  title={t('settings.externalLinks')}
                  description={t('settings.externalLinks.description')}
                  enabled={preferences.externalLinksInBrowser}
                  onChange={() =>
                    setPreference('externalLinksInBrowser', !preferences.externalLinksInBrowser)
                  }
                />
              </CardContent>
            </Card>
          </SettingsSection>

          <SettingsSection
            marker="B."
            title={t('settings.section.language')}
            description={t('settings.section.language.description')}
          >
            <ControlGroup
              title={t('settings.interfaceLanguage')}
              description={t('settings.interfaceLanguage.description')}
              className="grid gap-3 sm:grid-cols-2"
            >
              <ChoiceCard
                active={locale === 'pt-BR'}
                icon={Globe2}
                title={t('settings.portuguese')}
                description={t('settings.portuguese.description')}
                onClick={() => setLocale('pt-BR')}
              />
              <ChoiceCard
                active={locale === 'en'}
                icon={Languages}
                title={t('settings.english')}
                description={t('settings.english.description')}
                onClick={() => setLocale('en')}
              />
            </ControlGroup>

            <Card variant="inset">
              <CardContent className="divide-y divide-border p-0">
                <SelectRow
                  label={t('settings.dateFormat')}
                  description={t('settings.dateFormat.description')}
                  value={preferences.dateFormat}
                  onChange={(value) => setPreference('dateFormat', value)}
                  options={[
                    { label: 'dd/MM/yyyy', value: 'dd/MM/yyyy' },
                    { label: 'MM/dd/yyyy', value: 'MM/dd/yyyy' },
                    { label: 'yyyy-MM-dd', value: 'yyyy-MM-dd' },
                  ]}
                />
                <SelectRow
                  label={t('settings.currency')}
                  description={t('settings.currency.description')}
                  value={preferences.currency}
                  onChange={(value) => setPreference('currency', value)}
                  options={[
                    { label: 'USD - Dólar americano', value: 'USD' },
                    { label: 'BRL - Real brasileiro', value: 'BRL' },
                    { label: 'EUR - Euro', value: 'EUR' },
                  ]}
                />
                <SelectRow
                  label={t('settings.timezone')}
                  description={t('settings.timezone.description')}
                  value={preferences.timeZone}
                  onChange={(value) => setPreference('timeZone', value)}
                  options={[
                    { label: '(UTC-03:00) Brasília', value: 'America/Sao_Paulo' },
                    { label: '(UTC-05:00) New York', value: 'America/New_York' },
                    { label: '(UTC+00:00) London', value: 'Europe/London' },
                  ]}
                />
              </CardContent>
            </Card>
          </SettingsSection>

          <SettingsSection
            marker="C."
            title={t('settings.section.privacy')}
            description={t('settings.section.privacy.description')}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <PrivacyCard
                icon={ShieldCheck}
                title={t('settings.noTelemetry')}
                description={t('settings.noTelemetry.description')}
              />
              <PrivacyCard
                icon={LockKeyhole}
                title={t('settings.localPrompts')}
                description={t('settings.localPrompts.description')}
              />
              <PrivacyCard
                icon={Database}
                title={t('settings.sqlite')}
                description={t('settings.sqlite.description')}
              />
              <PrivacyCard
                icon={Download}
                title={t('settings.manualExport')}
                description={t('settings.manualExport.description')}
              />
            </div>
            <Card variant="inset">
              <CardContent className="divide-y divide-border p-0">
                <SwitchRow
                  title={t('settings.redactSensitiveData')}
                  description={t('settings.redactSensitiveData.description')}
                  enabled={Boolean(privacySettings?.redactSensitiveData)}
                  loading={privacyLoading && !privacySettings}
                  disabled={privacyUpdating || privacyLoading}
                  onChange={() => updateRedactSetting(!privacySettings?.redactSensitiveData)}
                />
              </CardContent>
            </Card>
          </SettingsSection>

          <SettingsSection
            marker="D."
            title={t('settings.section.startup')}
            description={t('settings.section.startup.description')}
          >
            {trayError ? (
              <ErrorState
                title={t('settings.tray.loadFailed')}
                message={trayError.message}
                code={trayError.code}
                details={trayError.details}
                onRetry={refetchTray}
              />
            ) : (
              <Card variant="inset">
                <CardContent className="divide-y divide-border p-0">
                  <SwitchRow
                    title={t('settings.tray.enable')}
                    description={t('settings.tray.enable.description')}
                    enabled={Boolean(trayStatus?.enabled)}
                    loading={trayLoading && !trayStatus}
                    disabled={trayUpdating || trayLoading || !trayStatus?.available}
                    onChange={() => updateTraySetting('enabled', !trayStatus?.enabled)}
                  />
                  <SwitchRow
                    title={t('settings.tray.autoStart')}
                    description={t('settings.tray.autoStart.description')}
                    enabled={Boolean(trayStatus?.autoStart)}
                    loading={trayLoading && !trayStatus}
                    disabled={trayUpdating || trayLoading || !trayStatus?.available}
                    onChange={() => updateTraySetting('autoStart', !trayStatus?.autoStart)}
                  />
                  <SwitchRow
                    title={t('settings.tray.startMinimized')}
                    description={t('settings.tray.startMinimized.description')}
                    enabled={Boolean(trayStatus?.startMinimized)}
                    loading={trayLoading && !trayStatus}
                    disabled={trayUpdating || trayLoading || !trayStatus?.available}
                    onChange={() =>
                      updateTraySetting('startMinimized', !trayStatus?.startMinimized)
                    }
                  />
                  <SwitchRow
                    title={t('settings.checkUpdates')}
                    description={t('settings.checkUpdates.description')}
                    enabled={preferences.checkUpdatesOnStartup}
                    onChange={() => {
                      const nextValue = !preferences.checkUpdatesOnStartup;
                      setPreference('checkUpdatesOnStartup', nextValue);
                      if (nextValue) void checkForUpdates();
                    }}
                  />
                </CardContent>
              </Card>
            )}
            {updateCheck ? (
              <div className="rounded-md border border-border bg-surface-muted p-3 text-xs leading-5 text-muted-foreground">
                <span className="font-semibold text-foreground">{t('settings.updateStatus')}:</span>{' '}
                {updateCheck.error
                  ? updateCheck.error
                  : `${t('settings.latestVersion')} ${updateCheck.latestVersion ?? '—'}`}
                <span className="block text-subtle-foreground">
                  {t('settings.lastChecked')} {formatDateTime(updateCheck.checkedAt)}
                </span>
              </div>
            ) : null}
            {trayStatus && !trayStatus.available ? (
              <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground">
                {t('settings.tray.windowsOnly')}
              </div>
            ) : null}
            {trayMutationError ? (
              <div className="font-mono text-sm text-danger">{trayMutationError}</div>
            ) : null}
          </SettingsSection>

          <SettingsSection
            marker="E."
            title={t('settings.section.ingestion')}
            description={t('settings.section.ingestion.description')}
            action={
              <Button onClick={runIngestion} disabled={ingestionRunning} size="sm">
                <Play className={cn('h-4 w-4', ingestionRunning && 'animate-spin')} />
                {ingestionRunning ? t('settings.running') : t('settings.runIngestion')}
              </Button>
            }
          >
            {ingestError ? (
              <ErrorState
                title={t('settings.ingestionFailed')}
                message={ingestError.message}
                code={ingestError.code}
                details={ingestError.details}
                onRetry={refetchIngest}
              />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusTile
                    label={t('settings.totalSessions')}
                    value={String(ingestStatus?.totalSessions ?? overview?.sessionCount ?? 0)}
                    loading={ingestLoading && !ingestStatus && overviewLoading && !overview}
                  />
                  <StatusTile
                    label={t('settings.new')}
                    value={String(ingestStatus?.newSessions ?? 0)}
                    loading={ingestLoading && !ingestStatus}
                  />
                  <StatusTile
                    label={t('settings.updated')}
                    value={String(ingestStatus?.updatedSessions ?? 0)}
                    loading={ingestLoading && !ingestStatus}
                  />
                </div>

                <Card variant="inset">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {t('settings.autoIngestion')}
                        </span>
                        <Badge variant={autoIngestion?.enabled ? 'success' : 'neutral'}>
                          {autoLoading && !autoIngestion
                            ? t('common.loading')
                            : autoIngestion?.enabled
                              ? t('settings.enabled')
                              : t('settings.disabled')}
                        </Badge>
                        {autoIngestion?.running ? (
                          <Badge variant="info">{t('settings.running')}</Badge>
                        ) : null}
                        {autoIngestion?.scheduled ? (
                          <Badge variant="warning">{t('settings.scheduled')}</Badge>
                        ) : null}
                      </div>
                      <Button
                        variant={autoIngestion?.enabled ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => setAutoIngestion(!autoIngestion?.enabled)}
                        disabled={autoUpdating || !autoIngestion}
                      >
                        {autoUpdating
                          ? t('settings.updating')
                          : autoIngestion?.enabled
                            ? t('settings.disableAutoIngestion')
                            : t('settings.enableAutoIngestion')}
                      </Button>
                    </div>

                    <div className="grid gap-0 overflow-hidden rounded-md border border-border bg-surface-muted md:grid-cols-4">
                      <MiniSummary
                        label={t('settings.watchedPaths')}
                        value={String(autoIngestion?.watchedPathCount ?? 0)}
                      />
                      <MiniSummary
                        label={t('settings.lastTrigger')}
                        value={
                          autoIngestion?.lastTriggeredAt
                            ? formatDateTime(autoIngestion.lastTriggeredAt)
                            : '—'
                        }
                      />
                      <MiniSummary
                        label={t('settings.lastRun')}
                        value={
                          autoIngestion?.lastRunCompletedAt
                            ? formatDateTime(autoIngestion.lastRunCompletedAt)
                            : '—'
                        }
                      />
                      <MiniSummary
                        label={t('settings.periodicScan')}
                        value={`${Math.round((autoIngestion?.periodicScanMs ?? 0) / 60000)} min`}
                      />
                    </div>

                    {(autoError || autoMutationError || autoIngestion?.lastError) && (
                      <div className="font-mono text-sm text-danger">
                        {autoError?.message ?? autoMutationError ?? autoIngestion?.lastError}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <ControlGroup
                  title={t('settings.supportedSources')}
                  description={t('settings.supportedSources.description')}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {adapterRows.length > 0 ? (
                    adapterRows.map(([cli, info]) => (
                      <SourcePill
                        key={cli}
                        cli={cli}
                        count={info.paths}
                        detected={info.detected}
                        suffix={t('settings.pathsDiscovered')}
                      />
                    ))
                  ) : (
                    <div className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted-foreground sm:col-span-2">
                      {t('settings.noSourcesYet')}
                    </div>
                  )}
                </ControlGroup>
              </>
            )}
          </SettingsSection>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SidePanel title={t('settings.workspaceSummary')} icon={SlidersHorizontal}>
            {overviewError ? (
              <ErrorState
                title={t('settings.overviewFailed')}
                message={overviewError.message}
                code={overviewError.code}
                details={overviewError.details}
                onRetry={refetchOverview}
              />
            ) : (
              <div className="grid gap-2">
                <MetricCard
                  label={t('common.sessions')}
                  value={overviewLoading && !overview ? '—' : String(overview?.sessionCount ?? 0)}
                  meta={t('common.sessions').toLowerCase()}
                />
                <MetricCard
                  label={t('settings.totalSpend')}
                  value={overviewLoading && !overview ? '—' : formatCurrency(overview?.totalSpend)}
                  meta={t('common.cost')}
                />
                <MetricCard
                  label={t('settings.topCli')}
                  value={overview?.mostUsedCli ? getBrandMeta(overview.mostUsedCli).label : '—'}
                  meta={t('common.cli')}
                />
              </div>
            )}
          </SidePanel>

          <SidePanel
            title={t('settings.localDatabase')}
            icon={Database}
            action={<Badge variant="success">{t('settings.local')}</Badge>}
          >
            <div className="grid gap-3 text-sm">
              <SummaryRow label={t('settings.engine')} value="SQLite via sql.js" />
              <SummaryRow label={t('settings.scope')} value={t('settings.thisMachine')} />
              <SummaryRow
                label={t('settings.sessionsIndexed')}
                value={String(overview?.sessionCount ?? 0)}
                loading={overviewLoading && !overview}
              />
              <SummaryRow label={t('settings.storage')} value={t('settings.localFile')} />
            </div>
          </SidePanel>

          <SidePanel title={t('settings.integrationHealth')} icon={RadioTower}>
            <div className="space-y-3">
              {integrationsLoading && integrationsList.length === 0
                ? Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))
                : integrationsList.map((item) => (
                    <IntegrationHealthRow key={item.cli} item={item} />
                  ))}
            </div>
          </SidePanel>

          <SidePanel
            title={t('budget.alerts.title')}
            icon={Bell}
            action={
              unacknowledgedAlerts.length > 0 ? (
                <Badge variant="danger">{unacknowledgedAlerts.length}</Badge>
              ) : (
                <Badge variant="success">0</Badge>
              )
            }
          >
            {alertsLoading && !alertsData ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t('common.loading')}
              </div>
            ) : alertsData && alertsData.alerts.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-surface-muted text-muted-foreground">
                  <Bell className="h-7 w-7" />
                </div>
                <div className="mt-4 text-sm font-semibold text-foreground">
                  {t('budget.alerts.empty.title')}
                </div>
                <p className="mx-auto mt-2 max-w-[220px] text-sm leading-6 text-muted-foreground">
                  {t('budget.alerts.empty.description')}
                </p>
              </div>
            ) : (
              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {(alertsData?.alerts ?? []).slice(0, 10).map((a) => (
                  <AlertItem key={a.id} alert={a} onAcknowledge={refetchAlerts} />
                ))}
              </div>
            )}
          </SidePanel>
        </aside>
      </div>
    </div>
  );
}

function SettingsSummaryCard({
  icon: Icon,
  label,
  value,
  meta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <Card variant="flat" className="min-h-[112px]">
      <CardContent className="flex h-full items-center gap-4 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-surface-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
          <div className="mt-2 truncate text-base font-semibold text-foreground">{value}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{meta}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsSection({
  marker,
  title,
  description,
  action,
  children,
}: {
  marker: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="flat">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 border-b border-border pb-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              <span className="mr-2 text-subtle-foreground">{marker}</span>
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ControlGroup({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className={className}>{children}</div>
    </div>
  );
}

function ChoiceCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-[76px] items-center justify-between gap-4 rounded-md border p-4 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
        active ? 'border-success bg-success-soft/30' : 'border-border bg-surface',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : null}
    </button>
  );
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        options={options}
        className="h-8 text-xs"
      />
    </div>
  );
}

function SwitchRow({
  title,
  description,
  enabled,
  disabled,
  loading,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-4 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      {loading ? <Skeleton className="h-6 w-11 rounded-full" /> : null}
      <button
        type="button"
        aria-pressed={enabled}
        aria-label={title}
        disabled={disabled || loading}
        onClick={onChange}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40 disabled:cursor-not-allowed disabled:opacity-50',
          enabled
            ? 'border-success/40 bg-success shadow-[0_0_0_1px_rgb(var(--success-rgb)/0.12)]'
            : 'border-border-strong bg-surface-muted',
          loading && 'hidden',
        )}
      >
        <span
          className={cn(
            'block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            enabled ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}

function PrivacyCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface-muted p-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
    </div>
  );
}

function StatusTile({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</div>
      )}
    </div>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border p-3 md:border-r md:last:border-r-0">
      <div className="text-[10px] font-semibold uppercase text-subtle-foreground">{label}</div>
      <div className="mt-2 truncate font-mono text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SourcePill({
  cli,
  count,
  detected,
  suffix,
}: {
  cli: string;
  count: number;
  detected: boolean;
  suffix: string;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark value={cli} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {getBrandMeta(cli).label}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {count} {suffix}
          </div>
        </div>
      </div>
      <Badge variant={detected ? 'success' : 'neutral'}>
        {detected ? t('common.detected') : t('common.missing')}
      </Badge>
    </div>
  );
}

function SidePanel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="flat">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-3 font-mono text-2xl font-semibold text-foreground">{value}</div>
      <Badge variant="neutral" className="mt-3">
        {meta}
      </Badge>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      {loading ? (
        <Skeleton className="h-4 w-20" />
      ) : (
        <span className="text-right font-mono font-semibold text-foreground">{value}</span>
      )}
    </div>
  );
}

function IntegrationHealthRow({ item }: { item: IntegrationStatusItem }) {
  const { t } = useI18n();
  const available = item.status === 'available';
  const driftCount =
    (item.sessionsZeroTokens ?? 0) + (item.sessionsNoCost ?? 0) + (item.sessionsNoModel ?? 0);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <BrandMark value={item.cli} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {getBrandMeta(item.cli).label}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {(item.pathsFound ?? 0).toString()} {t('settings.pathsDiscovered')}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {driftCount > 0 ? (
          <Badge
            variant="warning"
            title={`${item.sessionsZeroTokens ?? 0} zero-token · ${item.sessionsNoCost ?? 0} no-cost · ${item.sessionsNoModel ?? 0} no-model`}
          >
            <AlertTriangle className="h-3 w-3" />
            {driftCount} {t('settings.driftDetected')}
          </Badge>
        ) : null}
        {typeof item.completenessScore === 'number' ? (
          <Badge variant="neutral">{item.completenessScore}%</Badge>
        ) : null}
        <Badge variant={available ? 'success' : 'neutral'}>
          {available ? t('common.detected') : t('common.missing')}
        </Badge>
      </div>
    </div>
  );
}

function AlertItem({ alert, onAcknowledge }: { alert: AlertRow; onAcknowledge: () => void }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3 text-xs',
        alert.acknowledged
          ? 'border-border bg-surface-muted'
          : alert.type === 'exceeded'
            ? 'border-danger/30 bg-danger/5'
            : 'border-warning/30 bg-warning/5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {alert.type === 'exceeded' ? (
              <ShieldAlert className="h-3 w-3 shrink-0 text-danger" />
            ) : (
              <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
            )}
            <span className="font-mono font-semibold text-foreground">{alert.title}</span>
          </div>
          <div className="mt-1 text-muted-foreground">{alert.message}</div>
        </div>
        {!alert.acknowledged ? (
          <button
            type="button"
            onClick={async () => {
              await fetch(`/api/alerts/${alert.id}/acknowledge`, { method: 'POST' });
              onAcknowledge();
            }}
            className="shrink-0 rounded p-1 text-subtle-foreground transition-colors hover:text-accent"
          >
            <CheckCircle2 className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

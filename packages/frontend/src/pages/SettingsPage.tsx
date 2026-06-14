import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Globe2,
  Languages,
  LockKeyhole,
  Moon,
  Pencil,
  Play,
  Plus,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Webhook,
} from 'lucide-react';
import { BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { usePreferences } from '../components/preferences/PreferencesProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useApi, invalidateAllCaches } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime } from '../lib/format.js';
import { Sensitive } from '../components/ui/Sensitive.js';
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
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['appearance']));
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
  const {
    data: trayStatus,
    loading: trayLoading,
    error: trayError,
    refetch: refetchTray,
  } = useApi<TrayStatus>('/api/tray/status');
  const [trayUpdating, setTrayUpdating] = useState(false);
  const [trayMutationError, setTrayMutationError] = useState<string | null>(null);
  const [clearingAlerts, setClearingAlerts] = useState(false);
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

  const adapterRows = Object.entries(ingestStatus?.adapters ?? {});
  const unacknowledgedAlerts = (alertsData?.alerts ?? []).filter((a) => !a.acknowledged);
  const isValidating = overviewValidating || ingestValidating || autoValidating;

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  async function handleClearAlerts() {
    setClearingAlerts(true);
    try {
      await fetch('/api/alerts', { method: 'DELETE' });
      await refetchAlerts();
    } finally {
      setClearingAlerts(false);
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-3">
          <SettingsSection
            id="appearance"
            icon={Sun}
            marker="A."
            title={t('settings.section.appearance')}
            description={t('settings.section.appearance.description')}
            open={openSections.has('appearance')}
            onToggle={() => toggleSection('appearance')}
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
            id="language"
            icon={Globe2}
            marker="B."
            title={t('settings.section.language')}
            description={t('settings.section.language.description')}
            open={openSections.has('language')}
            onToggle={() => toggleSection('language')}
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
            id="privacy"
            icon={ShieldCheck}
            marker="C."
            title={t('settings.section.privacy')}
            description={t('settings.section.privacy.description')}
            open={openSections.has('privacy')}
            onToggle={() => toggleSection('privacy')}
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
            id="startup"
            icon={SlidersHorizontal}
            marker="D."
            title={t('settings.section.startup')}
            description={t('settings.section.startup.description')}
            open={openSections.has('startup')}
            onToggle={() => toggleSection('startup')}
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
            id="ingestion"
            icon={Database}
            marker="E."
            title={t('settings.section.ingestion')}
            description={t('settings.section.ingestion.description')}
            open={openSections.has('ingestion')}
            onToggle={() => toggleSection('ingestion')}
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

          <NotificationsSection
            open={openSections.has('notifications')}
            onToggle={() => toggleSection('notifications')}
          />
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
                  value={
                    overviewLoading && !overview ? (
                      '—'
                    ) : (
                      <Sensitive>{formatCurrency(overview?.totalSpend)}</Sensitive>
                    )
                  }
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

          <SidePanel
            title={t('budget.alerts.title')}
            icon={Bell}
            action={
              <div className="flex items-center gap-2">
                {alertsData && alertsData.alerts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAlerts}
                    disabled={clearingAlerts}
                    title={t('budget.alerts.clearAll')}
                    className="rounded p-1 text-subtle-foreground transition-colors hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {unacknowledgedAlerts.length > 0 ? (
                  <Badge variant="danger">{unacknowledgedAlerts.length}</Badge>
                ) : (
                  <Badge variant="success">0</Badge>
                )}
              </div>
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

function SettingsSection({
  id,
  icon: Icon,
  marker,
  title,
  description,
  action,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: LucideIcon;
  marker: string;
  title: string;
  description: string;
  action?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div id={`section-${id}`} className="scroll-mt-4">
      <Card variant="flat">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 p-4 text-left"
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] font-semibold text-subtle-foreground">
                {marker}
              </span>
              <span className="text-sm font-semibold text-foreground">{title}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
          </div>
          {open && action ? (
            <div role="none" onClick={(e) => e.stopPropagation()} className="shrink-0">
              {action}
            </div>
          ) : null}
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>

        {open ? (
          <CardContent className="space-y-4 border-t border-border px-4 pb-4 pt-4">
            {children}
          </CardContent>
        ) : null}
      </Card>
    </div>
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

function MetricCard({ label, value, meta }: { label: string; value: ReactNode; meta: string }) {
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

// ─── Notifications Section ───────────────────────────────────────────────────

type DestType = 'discord' | 'slack' | 'teams' | 'ntfy' | 'custom';
type EventType = 'ingestion_complete' | 'budget_warning' | 'budget_approaching' | 'budget_exceeded';

interface NotificationDestination {
  id: number;
  name: string;
  type: DestType;
  webhook_url: string;
  enabled: boolean;
  created_at: string;
  min_interval_minutes: number;
  last_notified_at: string | null;
  rules: Record<EventType, boolean>;
}

const COOLDOWN_OPTIONS = [0, 15, 30, 60, 360, 1440] as const;

function formatCooldownLabel(minutes: number, noneLabel = 'No limit'): string {
  if (minutes === 0) return noneLabel;
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? '1h' : `${hours}h`;
}

const DEST_TYPE_LABELS: Record<DestType, string> = {
  discord: 'Discord',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  ntfy: 'ntfy',
  custom: 'Custom',
};

const DEST_TYPE_PLACEHOLDERS: Record<DestType, string> = {
  discord: 'https://discord.com/api/webhooks/ID/TOKEN',
  slack: 'https://hooks.slack.com/services/T.../B.../...',
  teams: 'https://outlook.office.com/webhook/.../IncomingWebhook/...',
  ntfy: 'https://ntfy.sh/my-topic',
  custom: 'https://example.com/webhook',
};

const EVENT_KEYS: EventType[] = [
  'ingestion_complete',
  'budget_warning',
  'budget_approaching',
  'budget_exceeded',
];

function destTypeBadgeVariant(type: DestType): 'info' | 'success' | 'warning' | 'neutral' {
  if (type === 'discord') return 'info';
  if (type === 'slack') return 'success';
  if (type === 'teams') return 'info';
  if (type === 'ntfy') return 'warning';
  return 'neutral';
}

function maskWebhookUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return u.hostname;
    const last = parts[parts.length - 1];
    const masked = last.length > 12 ? `${last.slice(0, 4)}••••${last.slice(-4)}` : '••••••••';
    return `${u.hostname}/…/${masked}`;
  } catch {
    return url.length > 30 ? `${url.slice(0, 26)}…` : url;
  }
}

function NotificationsSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const {
    data: destinations,
    loading,
    refetch,
  } = useApi<NotificationDestination[]>('/api/notifications/destinations', { initialData: [] });

  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<DestType>('discord');
  const [formUrl, setFormUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, 'ok' | 'fail'>>({});
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const destList = destinations ?? [];

  async function handleSave() {
    if (!formName.trim() || !formUrl.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/notifications/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          webhook_url: formUrl.trim(),
        }),
      });
      setShowForm(false);
      setFormName('');
      setFormUrl('');
      setFormType('discord');
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(id: number) {
    setTestingId(id);
    setTestResult((prev) => ({ ...prev, [id]: undefined as unknown as 'ok' | 'fail' }));
    try {
      const res = await fetch(`/api/notifications/destinations/${id}/test`, { method: 'POST' });
      setTestResult((prev) => ({ ...prev, [id]: res.ok ? 'ok' : 'fail' }));
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: 'fail' }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/notifications/destinations/${id}`, { method: 'DELETE' });
    refetch();
  }

  async function handleToggleEnabled(dest: NotificationDestination) {
    setTogglingId(dest.id);
    try {
      await fetch(`/api/notifications/destinations/${dest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !dest.enabled }),
      });
      refetch();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleToggleEvent(
    dest: NotificationDestination,
    event: EventType,
    enabled: boolean,
  ) {
    await fetch(`/api/notifications/destinations/${dest.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: { [event]: enabled } }),
    });
    refetch();
  }

  return (
    <SettingsSection
      id="notifications"
      icon={Bell}
      marker="F."
      title={t('settings.section.notifications')}
      description={t('settings.section.notifications.description')}
      open={open}
      onToggle={onToggle}
      action={
        !showForm ? (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            {t('settings.notifications.addDestination')}
          </Button>
        ) : undefined
      }
    >
      {showForm && (
        <Card variant="inset">
          <CardContent className="space-y-3 p-4">
            <div className="flex gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('settings.notifications.name')}
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: My Alerts"
                />
              </div>
              <div className="w-44 shrink-0 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('settings.notifications.type')}
                </label>
                <Select
                  value={formType}
                  onChange={(e) => {
                    setFormType(e.target.value as DestType);
                    setFormUrl('');
                  }}
                  options={[
                    { label: 'Discord', value: 'discord' },
                    { label: 'Slack', value: 'slack' },
                    { label: 'Microsoft Teams', value: 'teams' },
                    { label: 'ntfy', value: 'ntfy' },
                    { label: 'Custom JSON', value: 'custom' },
                  ]}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('settings.notifications.webhookUrl')}
              </label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder={DEST_TYPE_PLACEHOLDERS[formType]}
                type="url"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setFormName('');
                  setFormUrl('');
                  setFormType('discord');
                }}
              >
                {t('settings.notifications.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formUrl.trim()}
              >
                {t('settings.notifications.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && destList.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      ) : destList.length === 0 && !showForm ? (
        <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border p-8 text-center">
          <Webhook className="h-8 w-8 text-subtle-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">
              {t('settings.notifications.noDestinations')}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t('settings.notifications.noDestinations.hint')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {destList.map((dest) => (
            <NotificationDestCard
              key={dest.id}
              dest={dest}
              testResult={testResult[dest.id]}
              testing={testingId === dest.id}
              toggling={togglingId === dest.id}
              onTest={() => handleTest(dest.id)}
              onDelete={() => handleDelete(dest.id)}
              onToggleEnabled={() => handleToggleEnabled(dest)}
              onToggleEvent={(event, enabled) => handleToggleEvent(dest, event, enabled)}
              onSaved={refetch}
            />
          ))}
        </div>
      )}
    </SettingsSection>
  );
}

function NotificationDestCard({
  dest,
  testResult,
  testing,
  toggling,
  onTest,
  onDelete,
  onToggleEnabled,
  onToggleEvent,
  onSaved,
}: {
  dest: NotificationDestination;
  testResult: 'ok' | 'fail' | undefined;
  testing: boolean;
  toggling: boolean;
  onTest: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onToggleEvent: (event: EventType, enabled: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(dest.name);
  const [editUrl, setEditUrl] = useState(dest.webhook_url);
  const [editCooldown, setEditCooldown] = useState(dest.min_interval_minutes);
  const [editSaving, setEditSaving] = useState(false);

  async function handleSaveEdit() {
    if (!editName.trim() || !editUrl.trim()) return;
    setEditSaving(true);
    try {
      await fetch(`/api/notifications/destinations/${dest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          webhook_url: editUrl.trim(),
          min_interval_minutes: editCooldown,
        }),
      });
      setEditMode(false);
      onSaved();
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditName(dest.name);
    setEditUrl(dest.webhook_url);
    setEditCooldown(dest.min_interval_minutes);
    setEditMode(false);
  }

  return (
    <Card variant="inset">
      <CardContent className="p-0">
        {/* ── Header row ── */}
        <div
          className={cn(
            'flex items-center gap-3 p-3 transition-opacity',
            !dest.enabled && 'opacity-60',
          )}
        >
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-surface-muted text-muted-foreground">
            <Webhook className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{dest.name}</span>
              <Badge variant={destTypeBadgeVariant(dest.type)}>{DEST_TYPE_LABELS[dest.type]}</Badge>
              {dest.min_interval_minutes > 0 && (
                <Badge variant="neutral">{formatCooldownLabel(dest.min_interval_minutes)}</Badge>
              )}
              {!dest.enabled && (
                <Badge variant="neutral">{t('settings.notifications.disabled')}</Badge>
              )}
            </div>
            <div className="mt-0.5 truncate font-mono text-[11px] text-subtle-foreground">
              {maskWebhookUrl(dest.webhook_url)}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {testResult === 'ok' && (
              <span className="mr-1 text-xs text-success">
                {t('settings.notifications.testSuccess')}
              </span>
            )}
            {testResult === 'fail' && (
              <span className="mr-1 text-xs text-danger">
                {t('settings.notifications.testFailed')}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={testing}
              className="h-7 px-2 text-xs"
            >
              {testing ? '…' : t('settings.notifications.test')}
            </Button>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={cn(
                'rounded p-1.5 transition-colors',
                editMode ? 'text-accent' : 'text-subtle-foreground hover:text-foreground',
              )}
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleEnabled}
              disabled={toggling}
              className="rounded p-1.5 text-subtle-foreground transition-colors hover:text-foreground"
              aria-label={dest.enabled ? 'Pausar' : 'Ativar'}
            >
              <Bell className={cn('h-3.5 w-3.5', !dest.enabled && 'opacity-40')} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1.5 text-subtle-foreground transition-colors hover:text-danger"
              aria-label="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Edit form ── */}
        {editMode && (
          <div className="space-y-3 border-t border-border bg-surface-muted/40 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('settings.notifications.name')}
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={dest.name}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('settings.notifications.webhookUrl')}
                </label>
                <Input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder={DEST_TYPE_PLACEHOLDERS[dest.type]}
                  type="url"
                />
              </div>
            </div>
            <div className="w-full space-y-1.5 sm:w-56">
              <label className="text-xs font-medium text-muted-foreground">
                {t('settings.notifications.cooldown')}
              </label>
              <Select
                value={String(editCooldown)}
                onChange={(e) => setEditCooldown(Number(e.target.value))}
                options={COOLDOWN_OPTIONS.map((minutes) => ({
                  label: formatCooldownLabel(minutes, t('settings.notifications.cooldown.none')),
                  value: String(minutes),
                }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                {t('settings.notifications.cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={editSaving || !editName.trim() || !editUrl.trim()}
              >
                {t('settings.notifications.save')}
              </Button>
            </div>
          </div>
        )}

        {/* ── Events row ── */}
        <div className="border-t border-border px-3 py-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
            {t('settings.notifications.events')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_KEYS.map((event) => {
              const active = dest.rules[event];
              return (
                <button
                  key={event}
                  type="button"
                  onClick={() => onToggleEvent(event, !active)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-accent/30 bg-accent-soft text-accent'
                      : 'border-border bg-surface text-subtle-foreground hover:border-border-strong hover:text-muted-foreground',
                  )}
                >
                  {t(`settings.notifications.event.${event}` as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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

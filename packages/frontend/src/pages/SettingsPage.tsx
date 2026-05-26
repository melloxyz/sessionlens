import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Database, Languages, LockKeyhole, Moon, RefreshCw, ShieldCheck, Sun } from 'lucide-react';
import { BrandMark, getBrandMeta } from '../components/brand/BrandMark.js';
import { useI18n } from '../components/i18n/LanguageProvider.js';
import { useTheme } from '../components/theme/ThemeProvider.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import type { IntegrationStatusItem } from '../components/layout/IntegrationStatus.js';
import { useApi } from '../hooks/useApi.js';
import { formatCurrency, formatDateTime } from '../lib/format.js';

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

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [ingestionRunning, setIngestionRunning] = useState(false);
  const { data: overview, error: overviewError, refetch: refetchOverview } = useApi<Overview>('/api/overview');
  const { data: ingestStatus, error: ingestError, refetch: refetchIngest } = useApi<IngestionStatus>('/api/ingest/status');
  const { data: integrations } = useApi<{ integrations: IntegrationStatusItem[] }>('/api/integrations/status', { initialData: { integrations: [] } });

  async function runIngestion() {
    setIngestionRunning(true);
    try {
      await fetch('/api/ingest', { method: 'POST' });
      await Promise.all([refetchIngest(), refetchOverview()]);
    } finally {
      setIngestionRunning(false);
    }
  }

  const adapterRows = Object.entries(ingestStatus?.adapters ?? {});
  const detectedCount = (integrations?.integrations ?? []).filter((item) => item.status === 'available').length;

  return (
    <div className="grid gap-5 p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-5">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.appearance')}</CardTitle>
              <CardDescription>Choose how AIMeter looks on this machine.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PreferenceButton active={theme === 'light'} icon={Sun} title="Light" description="Clean Linear-style surfaces." onClick={() => setTheme('light')} tone="warning" />
            <PreferenceButton active={theme === 'dark'} icon={Moon} title="Dark" description="OpenCode-inspired OLED theme." onClick={() => setTheme('dark')} tone="accent" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.language')}</CardTitle>
              <CardDescription>Interface language is stored locally in your browser.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <LanguageButton active={locale === 'en'} label="English" description="Default UI language" onClick={() => setLocale('en')} />
            <LanguageButton active={locale === 'pt-BR'} label="Português" description="Interface em português do Brasil" onClick={() => setLocale('pt-BR')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.privacy')}</CardTitle>
              <CardDescription>AIMeter reads local CLI state and keeps the product offline-first.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <PrivacyItem icon={ShieldCheck} title="No telemetry" description="No product analytics are sent externally." />
            <PrivacyItem icon={LockKeyhole} title="Local prompts" description="Prompts and responses stay on disk." />
            <PrivacyItem icon={Database} title="SQLite database" description="Usage is normalized into a local file." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('settings.ingestion')}</CardTitle>
              <CardDescription>Refresh indexed data from supported AI CLIs.</CardDescription>
            </div>
            <Button onClick={runIngestion} disabled={ingestionRunning}>
              <RefreshCw className={`h-4 w-4 ${ingestionRunning ? 'animate-spin' : ''}`} />
              {ingestionRunning ? 'Running' : 'Run ingestion'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {ingestError ? (
              <ErrorState title="Ingestion status failed" message={ingestError.message} code={ingestError.code} details={ingestError.details} onRetry={refetchIngest} />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatusTile label="Total sessions" value={String(ingestStatus?.totalSessions ?? overview?.sessionCount ?? 0)} />
                  <StatusTile label="New" value={String(ingestStatus?.newSessions ?? 0)} />
                  <StatusTile label="Updated" value={String(ingestStatus?.updatedSessions ?? 0)} />
                </div>
                <div className="rounded-2xl border border-border bg-surface-muted p-4 text-sm">
                  <SummaryRow label="Started" value={ingestStatus?.startedAt ? formatDateTime(ingestStatus.startedAt) : 'Not run in this process'} />
                  <SummaryRow label="Completed" value={ingestStatus?.completedAt ? formatDateTime(ingestStatus.completedAt) : ingestStatus?.message ?? '—'} />
                  <SummaryRow label="Warnings" value={String(ingestStatus?.errors?.length ?? 0)} />
                </div>
                {adapterRows.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {adapterRows.map(([cli, info]) => (
                      <div key={cli} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <BrandMark value={cli} size="sm" />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">{getBrandMeta(cli).label}</div>
                            <div className="text-xs text-subtle-foreground">{info.paths} paths discovered</div>
                          </div>
                        </div>
                        <Badge variant={info.detected ? 'success' : 'neutral'}>{info.detected ? 'Detected' : 'Missing'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Workspace Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {overviewError && <ErrorState title="Overview failed to load" message={overviewError.message} code={overviewError.code} details={overviewError.details} onRetry={refetchOverview} />}
            <SummaryRow label="Sessions" value={String(overview?.sessionCount ?? 0)} />
            <SummaryRow label="Total spend" value={formatCurrency(overview?.totalSpend)} />
            <SummaryRow label="Top CLI" value={overview?.mostUsedCli ? getBrandMeta(overview.mostUsedCli).label : '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local Database</CardTitle>
            <Badge variant="success">Local</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-border bg-surface-muted p-4 text-sm">
              <SummaryRow label="Engine" value="SQLite via sql.js" />
              <SummaryRow label="Scope" value="This machine only" />
              <SummaryRow label="Sessions indexed" value={String(overview?.sessionCount ?? 0)} />
              <SummaryRow label="Storage" value="Local file" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('settings.integrations')}</CardTitle>
            <Badge variant="neutral">{detectedCount}/{integrations?.integrations.length ?? 0}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {(integrations?.integrations ?? []).map((item) => (
              <div key={item.cli} className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted p-3">
                <div className="flex items-center gap-3">
                  <BrandMark value={item.cli} size="sm" />
                  <span className="text-sm font-medium text-foreground">{getBrandMeta(item.cli).label}</span>
                </div>
                <Badge variant={item.status === 'available' ? 'success' : 'neutral'}>{item.status === 'available' ? 'Detected' : 'Missing'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function PreferenceButton({ active, icon: Icon, title, description, onClick, tone }: { active: boolean; icon: LucideIcon; title: string; description: string; onClick: () => void; tone: 'warning' | 'accent' }) {
  return (
    <button onClick={onClick} className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all hover:bg-surface-hover ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
      <div>
        <Icon className={`mb-4 h-5 w-5 ${tone === 'warning' ? 'text-warning' : 'text-accent'}`} />
        <div className="font-medium text-foreground">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      {active && <CheckCircle2 className="h-5 w-5 text-accent" />}
    </button>
  );
}

function LanguageButton({ active, label, description, onClick }: { active: boolean; label: string; description: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all hover:bg-surface-hover ${active ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
      <div>
        <Languages className="mb-4 h-5 w-5 text-accent" />
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      {active && <CheckCircle2 className="h-5 w-5 text-accent" />}
    </button>
  );
}

function PrivacyItem({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="rounded-2xl border border-border bg-surface-muted p-4"><Icon className="mb-4 h-5 w-5 text-accent" /><div className="font-medium text-foreground">{title}</div><div className="mt-1 text-sm text-muted-foreground">{description}</div></div>;
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-surface-muted p-4"><div className="text-[11px] uppercase tracking-[0.14em] text-subtle-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">{value}</div></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium text-foreground">{value}</span></div>;
}
